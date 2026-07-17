import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";
import { callAi } from "@/lib/ai/provider-gateway";
import { ESTIMATED_AI_COST_USD } from "@/lib/cost-limit/cost-limit-types";
import { runMeteredAiCall } from "@/lib/cost-limit/run-metered-ai-call";
import { runSafetyCheck } from "@/lib/safety/safety-check-service";
import { runComplianceGate } from "@/features/legal/services/compliance-gate-service";
import { TradeRuleSchema } from "@/schemas/rules/trade-rule-schema";
import {
  HolisticReviewSchema,
  type HolisticReview,
} from "@/schemas/portfolio/holistic-review-schema";
import { getInvestmentMemory } from "@/features/trading/services/investment-memory-service";
import { calculatePortfolioSummary } from "@/features/portfolio/services/portfolio-aggregation-service";
import {
  buildHolisticReviewPrompt,
  HOLISTIC_REVIEW_PROMPT_VERSION,
} from "@/features/portfolio/prompts/holistic-review-prompt";
import { createNotification } from "@/features/notifications/services/notification-service";
import { retrieveRagContext } from "@/features/rag/services/retrieve-rag-context";
import { upsertRagDocumentFromHolisticReview } from "@/features/rag/services/upsert-rag-sources";

const REVIEW_DUE_DAYS = 90;
const SAFE_REVIEW_TEXT =
  "レビュー結果を安全に表示できないため、登録情報とルールを確認してください。";

export type HolisticReviewPosition = {
  ticker: string;
  companyName: string | null;
  marketValue: number;
  weightPercent: number;
  ruleSessionId: string | null;
  hasApprovedRule: boolean;
  hasExitCondition: boolean;
};

export type HolisticReviewFacts = {
  period: string;
  portfolio: {
    totalValue: number;
    cashAmount: number;
    cashWeightPercent: number;
    positionCount: number;
  };
  positions: HolisticReviewPosition[];
  approvedRuleCount: number;
  positionsWithoutApprovedRule: string[];
  positionsWithoutExitCondition: string[];
  staleRules: Array<{
    sessionId: string;
    ticker: string;
    lastReviewedAt: string | null;
  }>;
  invalidRuleJsonSessionIds: string[];
  investmentMemory: unknown;
  previousReview: unknown | null;
  alertResolutionContext: string;
  financialStatements: Array<{
    ticker: string;
    market: string;
    fiscalPeriod: string;
    revenue: number | null;
    operatingIncome: number | null;
    netIncome: number | null;
    eps: number | null;
    dividendPerShare: number | null;
    equityRatio: number | null;
    currency: string;
    filedAt: string | null;
    source: string;
  }>;
};

export type HolisticReviewResult = {
  id: string;
  period: string;
  review: HolisticReview;
  summaryText: string;
  model: string;
  safetyPassed: boolean;
  notificationId: string | null;
};

type ReviewPositionRow = {
  ticker?: unknown;
  market?: unknown;
  company_name?: unknown;
  market_value?: unknown;
  rule_session_id?: unknown;
};

type ReviewSessionRow = {
  id: string;
  ticker?: unknown;
  status?: unknown;
  quality_gate_status?: unknown;
  rule_json?: unknown;
  last_reviewed_at?: unknown;
};

export function getReviewPeriod(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function getPreviousReviewPeriod(period: string) {
  const [yearText, monthText] = period.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new AppError("VALIDATION_ERROR", "レビュー期間の形式が正しくありません。", 400);
  }
  return getReviewPeriod(new Date(Date.UTC(year, month - 2, 1)));
}

export function buildHolisticReviewFacts(params: {
  period?: string;
  cashAmount: number;
  positions: ReviewPositionRow[];
  sessions: ReviewSessionRow[];
  investmentMemory: unknown;
  previousReview?: unknown | null;
  alertResolutionContext?: string;
  financialStatements?: Array<Record<string, unknown>>;
  now?: Date;
}): HolisticReviewFacts {
  const now = params.now ?? new Date();
  const period = params.period ?? getReviewPeriod(now);
  const normalizedPositions = params.positions.map((position) => ({
    ticker: String(position.ticker ?? ""),
    market: String(position.market ?? "JP"),
    companyName:
      position.company_name == null ? null : String(position.company_name),
    marketValue: toNumber(position.market_value),
    ruleSessionId:
      position.rule_session_id == null ? null : String(position.rule_session_id),
  }));

  const summary = calculatePortfolioSummary({
    cashAmount: params.cashAmount,
    positions: normalizedPositions.map((position) => ({
      ticker: position.ticker,
      company_name: position.companyName,
      market_value: position.marketValue,
      rule_session_id: position.ruleSessionId,
    })),
  });
  const sessionById = new Map(params.sessions.map((session) => [session.id, session]));
  const approvedRuleIds = new Set(
    params.sessions
      .filter(isApprovedSession)
      .map((session) => session.id),
  );
  const invalidRuleJsonSessionIds: string[] = [];
  const hasExitBySessionId = new Map<string, boolean>();

  for (const session of params.sessions) {
    const parsed = TradeRuleSchema.safeParse(session.rule_json ?? {});
    if (!parsed.success) {
      invalidRuleJsonSessionIds.push(session.id);
      hasExitBySessionId.set(session.id, false);
      continue;
    }
    hasExitBySessionId.set(session.id, hasExitCondition(parsed.data));
  }

  const positions = normalizedPositions.map((position, index) => {
    const session = position.ruleSessionId
      ? sessionById.get(position.ruleSessionId)
      : undefined;
    const hasApprovedRule = Boolean(
      session && approvedRuleIds.has(session.id),
    );
    const result: HolisticReviewPosition = {
      ticker: position.ticker,
      companyName: position.companyName,
      marketValue: position.marketValue,
      weightPercent: summary.positionsWithWeight[index]?.weightPercent ?? 0,
      ruleSessionId: position.ruleSessionId,
      hasApprovedRule,
      hasExitCondition: Boolean(
        hasApprovedRule &&
          position.ruleSessionId &&
          hasExitBySessionId.get(position.ruleSessionId),
      ),
    };
    return result;
  });

  const staleRules = params.sessions
    .filter(isApprovedSession)
    .filter((session) => {
      const lastReviewedAt = normalizeNullableString(session.last_reviewed_at);
      if (!lastReviewedAt) return true;
      const reviewedAt = Date.parse(lastReviewedAt);
      return (
        !Number.isFinite(reviewedAt) ||
        now.getTime() - reviewedAt > REVIEW_DUE_DAYS * 24 * 60 * 60 * 1000
      );
    })
    .map((session) => ({
      sessionId: session.id,
      ticker: String(session.ticker ?? ""),
      lastReviewedAt: normalizeNullableString(session.last_reviewed_at),
    }));

  const heldTickerKeys = new Set(
    normalizedPositions.map((position) => `${position.market}:${position.ticker}`),
  );
  const financialStatements = (params.financialStatements ?? [])
    .map(normalizeFinancialStatement)
    .filter((statement) => heldTickerKeys.has(`${statement.market}:${statement.ticker}`));

  return {
    period,
    portfolio: {
      totalValue: summary.totalValue,
      cashAmount: params.cashAmount,
      cashWeightPercent: summary.cashWeightPercent,
      positionCount: normalizedPositions.length,
    },
    positions,
    approvedRuleCount: approvedRuleIds.size,
    positionsWithoutApprovedRule: positions
      .filter((position) => !position.hasApprovedRule)
      .map((position) => position.ticker),
    positionsWithoutExitCondition: positions
      .filter(
        (position) =>
          position.hasApprovedRule && !position.hasExitCondition,
      )
      .map((position) => position.ticker),
    staleRules,
    invalidRuleJsonSessionIds,
    investmentMemory: params.investmentMemory,
    previousReview: params.previousReview ?? null,
    alertResolutionContext: params.alertResolutionContext ?? "",
    financialStatements,
  };
}

export function sanitizeRelatedSymbols(
  review: HolisticReview,
  availableSymbols: Iterable<string>,
): HolisticReview {
  const symbols = new Set(availableSymbols);
  return {
    ...review,
    findings: review.findings.map((finding) => ({
      ...finding,
      relatedSymbols: finding.relatedSymbols.filter((symbol) =>
        symbols.has(symbol),
      ),
    })),
  };
}

export async function generateHolisticReview(params: {
  userId: string;
  period?: string;
  requestId?: string;
  now?: Date;
}) {
  const db = await createDatabaseClient();
  const period = params.period ?? getReviewPeriod(params.now);
  const existing = await findStoredReview({
    db,
    userId: params.userId,
    period,
  });
  if (existing) {
    const notificationId = await ensureReviewNotification({
      db,
      userId: params.userId,
      period,
      reviewRow: existing,
    });
    return {
      created: false,
      review: toReviewResult({ ...existing, notification_id: notificationId }),
    };
  }

  const previousPeriod = getPreviousReviewPeriod(period);
  // A period is a direct SQL key, so the previous review is loaded without
  // RAG. RAG is reserved for the unbounded set of current alert decisions.
  const [{ data: previousReview, error: previousReviewError }, alertResolutionContext] =
    await Promise.all([
      db
        .from("holistic_reviews")
        .select("period, review_json, summary_text")
        .eq("user_id", params.userId)
        .eq("period", previousPeriod)
        .maybeSingle(),
      retrieveRagContext({
        userId: params.userId,
        taskType: "holistic_review",
        queryText: `${period} のあなたの過去の判断記録`,
        sourceTypes: ["alert_resolution"],
        maxContextChars: 1500,
      }),
    ]);
  if (previousReviewError) throw previousReviewError;

  const [
    { data: portfolio, error: portfolioError },
    positionsResult,
    sessionsResult,
    memoryResult,
    financialStatementsResult,
  ] =
    await Promise.all([
      db
        .from("portfolios")
        .select("*")
        .eq("user_id", params.userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      db
        .from("portfolio_positions")
        .select("*")
        .eq("user_id", params.userId)
        .neq("position_status", "archived"),
      db
        .from("rule_design_sessions")
        .select("*")
        .eq("user_id", params.userId)
        .neq("status", "archived"),
      getInvestmentMemory(params.userId),
      db.from("financial_statements").select("*"),
    ]);

  if (portfolioError) throw portfolioError;
  if (positionsResult.error) throw positionsResult.error;
  if (sessionsResult.error) throw sessionsResult.error;
  if (financialStatementsResult.error) throw financialStatementsResult.error;

  const facts = buildHolisticReviewFacts({
    period,
    cashAmount: toNumber(portfolio?.cash_amount),
    positions: (positionsResult.data ?? []) as ReviewPositionRow[],
    sessions: (sessionsResult.data ?? []) as ReviewSessionRow[],
    investmentMemory: memoryResult.data,
    previousReview: previousReview ?? null,
    alertResolutionContext: alertResolutionContext.contextText,
    financialStatements: (financialStatementsResult.data ?? []) as Array<Record<string, unknown>>,
    now: params.now,
  });
  const prompt = buildHolisticReviewPrompt(facts);

  const aiResult = await runMeteredAiCall({
    userId: params.userId,
    feature: "holistic_review",
    estimatedCostUsd: ESTIMATED_AI_COST_USD.holistic_review,
    execute: async () => {
      const result = await callAi({
        userId: params.userId,
        requestId: params.requestId,
        sourceType: "portfolio",
        sourceId: portfolio?.id,
        taskType: "holistic_review",
        agentName: "holistic_review_agent",
        weight: "heavy",
        system: prompt.system,
        prompt: prompt.user,
        outputSchema: HolisticReviewSchema,
        schemaName: "HolisticReview",
        promptVersion: HOLISTIC_REVIEW_PROMPT_VERSION,
        inputJson: facts,
      });
      return {
        result,
        actualCostUsd: result.ok ? result.estimatedCostUsd : undefined,
      };
    },
  });

  if (!aiResult.ok) {
    throw new AppError(
      "AI_PROVIDER_ERROR",
      "月次総合レビューを生成できませんでした。しばらくしてからもう一度お試しください。",
      502,
      { providerError: aiResult.error },
      true,
    );
  }

  const sanitizedReview = sanitizeRelatedSymbols(
    aiResult.data,
    facts.positions.map((position) => position.ticker),
  );
  const safetyChecks = [
    sanitizedReview.overallNote,
    ...sanitizedReview.findings.map((finding) => finding.message),
  ].map((text) => runSafetyCheck({ text }));
  const safetyPassed = safetyChecks.every((safety) => safety.passed);
  const compliance = await runComplianceGate({
    userId: params.userId,
    reviewType: "holistic_review",
    text: [
      sanitizedReview.overallNote,
      ...sanitizedReview.findings.map((finding) => finding.message),
    ].join("\n"),
  });
  const displaySafe = safetyPassed && compliance.passed;
  const displayReview = displaySafe
    ? sanitizedReview
    : {
        findings: sanitizedReview.findings.map((finding) => ({
          ...finding,
          message: SAFE_REVIEW_TEXT,
        })),
        overallNote: SAFE_REVIEW_TEXT,
      };

  const { data: savedReview, error: saveError } = await db
    .from("holistic_reviews")
    .insert({
      user_id: params.userId,
      period,
      review_json: displayReview,
      summary_text: displayReview.overallNote,
      model: aiResult.model,
      estimated_cost_usd: aiResult.estimatedCostUsd ?? null,
      safety_passed: displaySafe,
      notification_id: null,
    })
    .select("*")
    .single();

  if (saveError || !savedReview) {
    const concurrentReview = await findStoredReview({
      db,
      userId: params.userId,
      period,
    });
    if (concurrentReview) {
      const notificationId = await ensureReviewNotification({
        db,
        userId: params.userId,
        period,
        reviewRow: concurrentReview,
      });
      return {
        created: false,
        review: toReviewResult({
          ...concurrentReview,
          notification_id: notificationId,
        }),
      };
    }
    throw new AppError(
      "DATABASE_ERROR",
      "月次総合レビューの保存に失敗しました。",
      500,
      saveError,
    );
  }

  const notificationId = await ensureReviewNotification({
    db,
    userId: params.userId,
    period,
    reviewRow: savedReview,
    portfolioId: portfolio?.id,
  });

  await upsertRagDocumentFromHolisticReview({
    userId: params.userId,
    reviewId: savedReview.id,
  });

  return {
    created: true,
    review: toReviewResult({ ...savedReview, notification_id: notificationId }),
  };
}

export async function listHolisticReviews(params: {
  userId: string;
  period?: string;
}): Promise<{ reviews: HolisticReviewResult[] }> {
  const db = await createDatabaseClient();
  let query = db
    .from("holistic_reviews")
    .select("*")
    .eq("user_id", params.userId)
    .order("period", { ascending: false });
  if (params.period) query = query.eq("period", params.period);

  const { data, error } = await query;
  if (error) {
    throw new AppError(
      "DATABASE_ERROR",
      "月次総合レビューの取得に失敗しました。",
      500,
      error,
    );
  }

  return {
    reviews: (data ?? []).map(toReviewResult),
  };
}

function isApprovedSession(session: ReviewSessionRow) {
  return (
    session.status === "finalized" ||
    session.quality_gate_status === "passed" ||
    session.quality_gate_status === "approved"
  );
}

function hasExitCondition(rule: {
  exitPlan?: {
    exitConditions?: string[];
    targetPrice?: number;
    targetMultiple?: number;
    takeProfitRule?: string;
  };
  exitTriggers?: unknown[];
  riskManagement?: { stopLossRule?: string };
}) {
  return Boolean(
    rule.exitPlan?.exitConditions?.length ||
      rule.exitPlan?.targetPrice != null ||
      rule.exitPlan?.targetMultiple != null ||
      rule.exitPlan?.takeProfitRule?.trim() ||
      rule.exitTriggers?.length ||
      rule.riskManagement?.stopLossRule?.trim(),
  );
}

function toNumber(value: unknown) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function normalizeFinancialStatement(row: Record<string, unknown>) {
  return {
    ticker: String(row.ticker ?? ""),
    market: String(row.market ?? "JP"),
    fiscalPeriod: String(row.fiscal_period ?? ""),
    revenue: nullableNumber(row.revenue),
    operatingIncome: nullableNumber(row.operating_income),
    netIncome: nullableNumber(row.net_income),
    eps: nullableNumber(row.eps),
    dividendPerShare: nullableNumber(row.dividend_per_share),
    equityRatio: nullableNumber(row.equity_ratio),
    currency: String(row.currency ?? "JPY"),
    filedAt: row.filed_at == null ? null : String(row.filed_at),
    source: String(row.source ?? "unknown"),
  };
}

function nullableNumber(value: unknown) {
  if (value == null) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function normalizeNullableString(value: unknown) {
  if (value == null || String(value).trim() === "") return null;
  return String(value);
}

type ReviewRow = Record<string, unknown> & {
  id: string;
  notification_id?: string | null;
  review_json: unknown;
  summary_text: string;
  safety_passed: boolean | number;
  period: string;
  model: string;
};

async function findStoredReview(params: {
  db: Awaited<ReturnType<typeof createDatabaseClient>>;
  userId: string;
  period: string;
}) {
  const { data, error } = await params.db
    .from("holistic_reviews")
    .select("*")
    .eq("user_id", params.userId)
    .eq("period", params.period)
    .maybeSingle();
  if (error) {
    throw new AppError(
      "DATABASE_ERROR",
      "月次総合レビューの重複確認に失敗しました。",
      500,
      error,
    );
  }
  return (data as ReviewRow | null) ?? null;
}

async function ensureReviewNotification(params: {
  db: Awaited<ReturnType<typeof createDatabaseClient>>;
  userId: string;
  period: string;
  reviewRow: ReviewRow;
  portfolioId?: string;
}): Promise<string> {
  if (params.reviewRow.notification_id) return params.reviewRow.notification_id;

  const { notification } = await createNotification({
    userId: params.userId,
    notificationType: "holistic_review_ready",
    title: "今月の総合レビューができました",
    body: "今月のポートフォリオとルールの総合レビューができました。確認してください。",
    severity: "info",
    targetType: "portfolio",
    targetId: params.portfolioId,
    actionUrl: `/portfolio/review/monthly?period=${encodeURIComponent(params.period)}`,
    metadata: { period: params.period },
  });

  await params.db
    .from("holistic_reviews")
    .update({ notification_id: notification.id })
    .eq("id", params.reviewRow.id)
    .eq("user_id", params.userId);

  return notification.id;
}

function toReviewResult(row: ReviewRow): HolisticReviewResult {
  const parsed = HolisticReviewSchema.safeParse(row.review_json);
  if (!parsed.success) {
    throw new AppError(
      "DATABASE_ERROR",
      "保存された月次総合レビューの形式が正しくありません。",
      500,
      parsed.error.flatten(),
    );
  }

  return {
    id: row.id,
    period: row.period,
    review: parsed.data,
    summaryText: row.summary_text,
    model: row.model,
    safetyPassed: Boolean(row.safety_passed),
    notificationId: row.notification_id ?? null,
  };
}
