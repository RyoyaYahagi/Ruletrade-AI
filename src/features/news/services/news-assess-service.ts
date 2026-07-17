import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";
import { callAi } from "@/lib/ai/provider-gateway";
import { runMeteredAiCall } from "@/lib/cost-limit/run-metered-ai-call";
import { ESTIMATED_AI_COST_USD } from "@/lib/cost-limit/cost-limit-types";
import { runSafetyCheck } from "@/lib/safety/safety-check-service";
import { runComplianceGate } from "@/features/legal/services/compliance-gate-service";
import { logError } from "@/lib/observability/structured-logger";
import { createNotification } from "@/features/notifications/services/notification-service";
import { TradeRuleSchema, type TradeRule } from "@/schemas/rules/trade-rule-schema";
import {
  NewsClassificationSchema,
  NewsSummarySchema,
} from "@/schemas/news/news-schema";

export const MAX_CLASSIFY_PER_USER_PER_DAY = 20;
export const MAX_SUMMARIZE_PER_USER_PER_DAY = 5;
const SUMMARY_BLOCKED_MESSAGE = "関係する可能性のあるニュースがあります（要約は表示できません）。";

type NewsItem = {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  published_at: string;
};

type NewsMatch = { news_item_id: string; symbol: string; market: string };
type RuleSession = {
  id: string;
  ticker: string;
  company_name: string | null;
  rule_json: unknown;
  status: string;
};

function parseRule(value: unknown): TradeRule | null {
  const parsed = TradeRuleSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : null;
}

async function classifyNews(params: {
  userId: string;
  sessionId: string;
  article: NewsItem;
  rule: TradeRule;
}) {
  return runMeteredAiCall({
    userId: params.userId,
    feature: "news_classify",
    estimatedCostUsd: ESTIMATED_AI_COST_USD.news_classify,
    execute: async () => {
      const response = await callAi({
        taskType: "news_classify",
        weight: "light",
        userId: params.userId,
        sourceType: "rule_session",
        sourceId: params.sessionId,
        sessionId: params.sessionId,
        inputJson: {
          articleId: params.article.id,
          title: params.article.title,
          thesis: params.rule.investmentThesis,
        },
        system:
          "ニュースがユーザーの仮説に関係するかだけを判定してください。売買判断や市場予測は出力しないでください。",
        prompt: JSON.stringify({
          title: params.article.title,
          summary: params.article.summary,
          investmentThesis: params.rule.investmentThesis ?? null,
          thesisBreakers: params.rule.thesisBreakers,
        }),
        outputSchema: NewsClassificationSchema,
        schemaName: "NewsClassification",
      });
      if (!response.ok) throw new Error(response.error);
      return { result: response.data, actualCostUsd: response.estimatedCostUsd };
    },
  });
}

async function summarizeNews(params: {
  userId: string;
  sessionId: string;
  article: NewsItem;
  rule: TradeRule;
  relation: string | undefined;
  breakerIndex: number | null;
}) {
  const summary = await runMeteredAiCall({
    userId: params.userId,
    feature: "news_summarize",
    estimatedCostUsd: ESTIMATED_AI_COST_USD.news_summarize,
    execute: async () => {
      const response = await callAi({
        taskType: "news_summarize",
        weight: "standard",
        userId: params.userId,
        sourceType: "rule_session",
        sourceId: params.sessionId,
        sessionId: params.sessionId,
        inputJson: { articleId: params.article.id, relation: params.relation },
        system:
          "記事にない事実を追加せず、売買を勧めず、仮説の当否を断定せずに要約してください。",
        prompt: JSON.stringify({
          title: params.article.title,
          summary: params.article.summary,
          relation: params.relation,
          breaker:
            params.breakerIndex === null
              ? null
              : params.rule.thesisBreakers[params.breakerIndex]?.description ?? null,
        }),
        outputSchema: NewsSummarySchema,
        schemaName: "NewsSummary",
      });
      if (!response.ok) throw new Error(response.error);
      return { result: response.data, actualCostUsd: response.estimatedCostUsd };
    },
  });

  const safety = runSafetyCheck({ text: summary.summary });
  const compliance = await runComplianceGate({
    userId: params.userId,
    reviewType: "news_summary",
    text: summary.summary,
  });
  // Safety or compliance failure must never expose the generated text to the user.
  if (!safety.passed || !compliance.passed) return SUMMARY_BLOCKED_MESSAGE;
  return summary.summary;
}

function buildNotificationBody(params: {
  session: RuleSession;
  article: NewsItem;
  rule: TradeRule;
  breakerIndex: number | null;
}) {
  const breaker =
    params.breakerIndex === null
      ? null
      : params.rule.thesisBreakers[params.breakerIndex]?.description;
  const reference = breaker ? `破れ条件『${breaker}』` : "仮説";
  const company = params.session.company_name ?? params.session.ticker;
  return `${company} (${params.session.ticker}) に関するニュース: ${params.article.title}。あなたの${reference}に関係する可能性があります。内容を確認してください。`;
}

export async function assessNewsForAllUsers() {
  const db = await createDatabaseClient();
  const [{ data: users, error: usersError }, { data: articles, error: articlesError }, { data: matches, error: matchesError }] =
    await Promise.all([
      db.from("app_users").select("id").limit(5000),
      db.from("news_items").select("*").order("published_at", { ascending: false }).limit(5000),
      db.from("news_ticker_matches").select("*").limit(10000),
    ]);
  if (usersError || articlesError || matchesError) throw usersError ?? articlesError ?? matchesError;

  const newsArticles = (articles ?? []) as NewsItem[];
  const articleById = new Map<string, NewsItem>(
    newsArticles.map((article) => [String(article.id), article]),
  );
  const matchesBySymbol = new Map<string, NewsMatch[]>();
  for (const match of matches ?? []) {
    const key = String(match.symbol).toUpperCase();
    const list = matchesBySymbol.get(key) ?? [];
    list.push(match as NewsMatch);
    matchesBySymbol.set(key, list);
  }

  let classifiedCount = 0;
  let summarizedCount = 0;
  let notificationCount = 0;
  let errorCount = 0;
  let costLimitedUserCount = 0;

  for (const user of users ?? []) {
    const userId = String(user.id);
    const { data: sessions, error: sessionsError } = await db
      .from("rule_design_sessions")
      .select("id, ticker, company_name, rule_json, status")
      .eq("user_id", userId)
      .limit(5000);
    if (sessionsError) throw sessionsError;

    const candidates: Array<{ session: RuleSession; article: NewsItem; rule: TradeRule }> = [];
    for (const rawSession of sessions ?? []) {
      const session = rawSession as RuleSession;
      if (!["finalized", "approved", "quality_gate_passed"].includes(session.status)) continue;
      const rule = parseRule(session.rule_json);
      if (!rule) {
        errorCount += 1;
        logError("ニュース判定対象のルール形式が不正です。", {
          userId,
          sessionId: session.id,
        });
        continue;
      }
      for (const match of matchesBySymbol.get(session.ticker.toUpperCase()) ?? []) {
        const article = articleById.get(match.news_item_id);
        if (!article) continue;
        const { data: existing } = await db
          .from("news_assessments")
          .select("id")
          .eq("user_id", userId)
          .eq("news_item_id", article.id)
          .eq("session_id", session.id)
          .maybeSingle();
        if (!existing) candidates.push({ session, article, rule });
      }
    }

    let userCostLimited = false;
    let userSummarizedCount = 0;
    for (const candidate of candidates.slice(0, MAX_CLASSIFY_PER_USER_PER_DAY)) {
      try {
        const classification = await classifyNews({
          userId,
          sessionId: candidate.session.id,
          article: candidate.article,
          rule: candidate.rule,
        });
        classifiedCount += 1;
        const affectsThesis = classification.relevance === "affects_thesis";
        const breakerIndex =
          classification.matchedBreakerIndex !== null &&
          classification.matchedBreakerIndex < candidate.rule.thesisBreakers.length
            ? classification.matchedBreakerIndex
            : null;
        let summaryText: string | null = null;
        if (affectsThesis && userSummarizedCount < MAX_SUMMARIZE_PER_USER_PER_DAY) {
          try {
            summaryText = await summarizeNews({
              userId,
              sessionId: candidate.session.id,
              article: candidate.article,
              rule: candidate.rule,
              relation: classification.thesisRelation,
              breakerIndex,
            });
            summarizedCount += 1;
            userSummarizedCount += 1;
          } catch (error) {
            if (error instanceof AppError && error.status === 402) {
              userCostLimited = true;
              break;
            }
            errorCount += 1;
            logError("ニュース要約に失敗しました。", {
              userId,
              sessionId: candidate.session.id,
              newsItemId: candidate.article.id,
              error: error instanceof Error ? error.message : String(error),
            });
            summaryText = SUMMARY_BLOCKED_MESSAGE;
          }
        }

        const { data: assessment, error: assessmentError } = await db
          .from("news_assessments")
          .insert({
            user_id: userId,
            news_item_id: candidate.article.id,
            session_id: candidate.session.id,
            relevance: classification.relevance,
            thesis_relation: classification.thesisRelation ?? null,
            matched_breaker_index: breakerIndex,
            summary_text: summaryText,
            model: "configured",
            estimated_cost_usd:
              ESTIMATED_AI_COST_USD.news_classify +
              (summaryText ? ESTIMATED_AI_COST_USD.news_summarize : 0),
          })
          .select("id")
          .single();
        if (assessmentError) {
          if (/unique|constraint/i.test(assessmentError.message)) continue;
          throw assessmentError;
        }
        if (affectsThesis && assessment?.id) {
          const notification = await createNotification({
            userId,
            notificationType: "news_thesis_impact",
            title: "仮説に関係する可能性のあるニュースがあります",
            body: buildNotificationBody({
              session: candidate.session,
              article: candidate.article,
              rule: candidate.rule,
              breakerIndex,
            }),
            severity: "info",
            targetType: "news_item",
            targetId: candidate.article.id,
            actionUrl: `/rules/${candidate.session.id}/news`,
            metadata: { assessmentId: assessment.id, sourceUrl: candidate.article.url },
          });
          await db
            .from("news_assessments")
            .update({ notification_id: notification.notification.id })
            .eq("id", assessment.id)
            .eq("user_id", userId);
          notificationCount += 1;
        }
      } catch (error) {
        if (error instanceof AppError && error.status === 402) {
          userCostLimited = true;
          break;
        }
        errorCount += 1;
        logError("ニュース分類に失敗しました。", {
          userId,
          sessionId: candidate.session.id,
          newsItemId: candidate.article.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (userCostLimited) costLimitedUserCount += 1;
  }

  return {
    classifiedCount,
    summarizedCount,
    notificationCount,
    errorCount,
    costLimitedUserCount,
  };
}

export async function listNewsAssessments(params: {
  userId: string;
  sessionId: string;
}) {
  const db = await createDatabaseClient();
  const { data: session, error: sessionError } = await db
    .from("rule_design_sessions")
    .select("id")
    .eq("id", params.sessionId)
    .eq("user_id", params.userId)
    .single();
  if (sessionError || !session) throw new AppError("NOT_FOUND", "ルール作成セッションが見つかりません。", 404);

  const { data, error } = await db
    .from("news_assessments")
    .select("*")
    .eq("user_id", params.userId)
    .eq("session_id", params.sessionId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const enriched = [];
  for (const assessment of data ?? []) {
    const { data: article } = await db
      .from("news_items")
      .select("id, title, summary, url, published_at, source")
      .eq("id", assessment.news_item_id)
      .single();
    enriched.push({ ...assessment, article: article ?? null });
  }
  return { assessments: enriched };
}
