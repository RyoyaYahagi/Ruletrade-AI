import "server-only";

import {
  buildAttentionStatusMap,
  isApprovedRuleSession,
  isRuleReviewDue,
  loadAttentionStatusRecords,
  type AttentionSessionRow,
  type AttentionStatus,
  type AttentionStatusRecords,
} from "@/features/ux/services/attention-status-service";
import {
  getInvestmentMemory,
  type InvestmentMemory,
} from "@/features/trading/services/investment-memory-service";
import {
  TradeRuleSchema,
  type TradeRule,
} from "@/schemas/rules/trade-rule-schema";

export type RuleCategoryKey = "entry" | "exit" | "risk" | "thesis";
export type RuleCoverage = Record<RuleCategoryKey, boolean>;

export type RuleSystemPolicy = {
  riskTolerance: "conservative" | "moderate" | "aggressive" | null;
  preferredMarkets: string[];
  standingConstraints: string[];
};

export type RuleSystemSession = {
  id: string;
  ticker: string;
  companyName: string | null;
  status: string;
  attentionStatus: AttentionStatus;
  coverage: RuleCoverage;
  gaps: RuleCategoryKey[];
  ruleParseFailed: boolean;
  reviewDue: boolean;
  lastReviewedAt: string | null;
  updatedAt: string;
};

export type RuleSystemPosition = {
  id: string;
  ticker: string;
  companyName: string | null;
};

export type RuleSystemOverview = {
  policy: RuleSystemPolicy | null;
  sessions: RuleSystemSession[];
  unlinkedPositions: RuleSystemPosition[];
  stats: {
    sessionsTotal: number;
    approvedCount: number;
    gapsTotal: number;
    reviewDueCount: number;
    unlinkedCount: number;
  };
};

const EMPTY_COVERAGE: RuleCoverage = {
  entry: false,
  exit: false,
  risk: false,
  thesis: false,
};

export function computeRuleCoverage(ruleJson: unknown): {
  coverage: RuleCoverage;
  ruleParseFailed: boolean;
} {
  const candidate = parseRuleJson(ruleJson);
  const parsed = TradeRuleSchema.safeParse(candidate);
  if (!parsed.success) {
    return { coverage: { ...EMPTY_COVERAGE }, ruleParseFailed: true };
  }

  return {
    coverage: {
      entry: hasEntryCoverage(parsed.data),
      exit: hasExitCoverage(parsed.data),
      risk: hasRiskCoverage(parsed.data),
      thesis: hasThesisCoverage(parsed.data),
    },
    ruleParseFailed: false,
  };
}

export function buildRuleSystemOverview(
  records: AttentionStatusRecords,
  memory: InvestmentMemory | null,
  now = new Date(),
): RuleSystemOverview {
  const attentionStatuses = buildAttentionStatusMap(records, now);
  const sessions = records.sessions
    .filter((session) => stringValue(session.status) !== "archived")
    .map((session) => buildSessionOverview(session, attentionStatuses, now))
    .sort(
      (left, right) => dateValue(right.updatedAt) - dateValue(left.updatedAt),
    );

  const unlinkedPositions = records.positions
    .filter(
      (position) =>
        stringValue(position.position_status) === "active" &&
        position.rule_session_id == null,
    )
    .map((position) => ({
      id: stringValue(position.id),
      ticker: stringValue(position.ticker),
      companyName: nullableString(position.company_name),
    }));

  return {
    policy: buildPolicy(memory),
    sessions,
    unlinkedPositions,
    stats: {
      sessionsTotal: sessions.length,
      approvedCount: sessions.filter((session) => {
        const source = records.sessions.find(
          (candidate) => candidate.id === session.id,
        );
        return source ? isApprovedRuleSession(source) : false;
      }).length,
      gapsTotal: sessions.reduce(
        (total, session) => total + session.gaps.length,
        0,
      ),
      reviewDueCount: sessions.filter((session) => session.reviewDue).length,
      unlinkedCount: unlinkedPositions.length,
    },
  };
}

export async function getRuleSystemOverview(params: {
  userId: string;
  now?: Date;
}): Promise<RuleSystemOverview> {
  const [records, memory] = await Promise.all([
    loadAttentionStatusRecords(params.userId),
    getInvestmentMemory(params.userId),
  ]);

  return buildRuleSystemOverview(records, memory.data, params.now);
}

function buildSessionOverview(
  session: AttentionSessionRow,
  attentionStatuses: Map<string, AttentionStatus>,
  now: Date,
): RuleSystemSession {
  const { coverage, ruleParseFailed } = computeRuleCoverage(session.rule_json);
  const gaps = (Object.keys(coverage) as RuleCategoryKey[]).filter(
    (category) => !coverage[category],
  );

  return {
    id: session.id,
    ticker: stringValue(session.ticker),
    companyName: nullableString(session.company_name),
    status: stringValue(session.status),
    attentionStatus: attentionStatuses.get(session.id) ?? "needs_check",
    coverage,
    gaps,
    ruleParseFailed,
    reviewDue: isRuleReviewDue(session, now),
    lastReviewedAt: nullableString(session.last_reviewed_at),
    updatedAt: stringValue(session.updated_at),
  };
}

function buildPolicy(memory: InvestmentMemory | null): RuleSystemPolicy | null {
  if (!memory) return null;

  const riskTolerance = memory.risk_tolerance;
  return {
    riskTolerance:
      riskTolerance === "conservative" ||
      riskTolerance === "moderate" ||
      riskTolerance === "aggressive"
        ? riskTolerance
        : null,
    preferredMarkets: stringArray(memory.preferred_markets),
    standingConstraints: stringArray(memory.standing_constraints),
  };
}

function parseRuleJson(value: unknown): unknown {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function hasEntryCoverage(rule: TradeRule) {
  return (
    rule.entryPlan.targetPriceMin !== undefined ||
    rule.entryPlan.targetPriceMax !== undefined ||
    rule.entryPlan.tranches !== undefined ||
    rule.entryPlan.entryConditions.length > 0
  );
}

function hasExitCoverage(rule: TradeRule) {
  return (
    rule.exitPlan.targetPrice !== undefined ||
    rule.exitPlan.targetMultiple !== undefined ||
    Boolean(rule.exitPlan.takeProfitRule?.trim()) ||
    rule.exitPlan.exitConditions.length > 0 ||
    rule.exitTriggers.length > 0
  );
}

function hasRiskCoverage(rule: TradeRule) {
  return (
    rule.riskManagement.maxPositionPercent !== undefined ||
    rule.riskManagement.maxPositionAmount !== undefined ||
    rule.riskManagement.maxLossPercent !== undefined ||
    Boolean(rule.riskManagement.stopLossRule?.trim()) ||
    rule.riskManagement.riskNotes.length > 0
  );
}

function hasThesisCoverage(rule: TradeRule) {
  return (
    Boolean(rule.investmentThesis?.trim()) || rule.thesisBreakers.length > 0
  );
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function nullableString(value: unknown): string | null {
  const normalized = stringValue(value).trim();
  return normalized || null;
}

function stringValue(value: unknown): string {
  return value == null ? "" : String(value);
}

function dateValue(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}
