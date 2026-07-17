import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";
import {
  TradeRuleSchema,
  type ThesisBreaker,
} from "@/schemas/rules/trade-rule-schema";

export async function applyAnswerToRuleJson(params: {
  userId: string;
  sessionId: string;
  questionKey: string;
  answerJson: unknown;
  answerText?: string;
}) {
  const db = await createDatabaseClient();
  const { data: session, error: sessionError } = await db
    .from("rule_design_sessions")
    .select("id, rule_json, question_count")
    .eq("id", params.sessionId)
    .eq("user_id", params.userId)
    .single();
  if (sessionError || !session) {
    throw new AppError(
      "NOT_FOUND",
      "ルール作成セッションが見つかりません。",
      404,
    );
  }
  const currentRule = TradeRuleSchema.parse(session.rule_json ?? {});
  const nextRule = structuredClone(currentRule);
  const answerValue = getAnswerValue(params.answerJson);
  switch (params.questionKey) {
    case "holding_purpose":
      if (typeof answerValue === "string") {
        nextRule.purpose = answerValue as typeof nextRule.purpose;
      }
      break;
    case "time_horizon":
      if (typeof answerValue === "string") {
        nextRule.timeHorizon = answerValue as typeof nextRule.timeHorizon;
      }
      break;
    case "thesis_draft":
      nextRule.investmentThesis = getAnswerText(params);
      break;
    case "thesis_breakers_pick":
      nextRule.thesisBreakers = buildThesisBreakers(params.answerJson);
      break;
    case "stop_loss_review":
      setNestedRuleValue(nextRule, "monitoring.stopLossReviewPercent", answerValue);
      break;
    case "take_profit_review":
      setNestedRuleValue(nextRule, "monitoring.takeProfitReviewPercent", answerValue);
      break;
    case "max_position":
      setNestedRuleValue(nextRule, "riskManagement.maxPositionPercent", answerValue);
      break;
    case "earnings_policy":
      setNestedRuleValue(nextRule, "earningsPolicy.policy", answerValue);
      break;
    case "review_cycle":
      setNestedRuleValue(nextRule, "monitoring.reviewCycle", answerValue);
      break;
    case "thesis_seed":
      break;
    case "entry_price_range":
      if (typeof params.answerJson === "object" && params.answerJson !== null) {
        const value = params.answerJson as {
          min?: number;
          max?: number;
          currency?: string;
        };
        nextRule.entryPlan = {
          ...nextRule.entryPlan,
          targetPriceMin: value.min,
          targetPriceMax: value.max,
          currency:
            (value.currency as typeof nextRule.entryPlan.currency) ?? "JPY",
        };
      }
      break;
    case "stop_loss_rule":
      nextRule.riskManagement = {
        ...nextRule.riskManagement,
        stopLossRule: params.answerText,
      };
      break;
    default:
      nextRule.freeNotes = [nextRule.freeNotes, params.answerText]
        .filter(Boolean)
        .join("\n");
      break;
  }
  const parsed = TradeRuleSchema.parse(nextRule);
  const { data, error } = await db
    .from("rule_design_sessions")
    .update({
      rule_json: parsed,
      question_count: (session.question_count ?? 0) + 1,
      status: "in_progress",
    })
    .eq("id", params.sessionId)
    .eq("user_id", params.userId)
    .select("rule_json")
    .single();
  if (error || !data) {
    throw new AppError(
      "INTERNAL_ERROR",
      "ルール草案の更新に失敗しました。",
      500,
      error,
    );
  }
  return data.rule_json;
}

function getAnswerValue(answerJson: unknown) {
  if (typeof answerJson !== "object" || answerJson === null) return undefined;
  if (!("value" in answerJson)) return undefined;
  return (answerJson as { value: unknown }).value;
}

function getAnswerText(params: { answerJson: unknown; answerText?: string }) {
  if (params.answerText?.trim()) return params.answerText.trim();
  if (
    typeof params.answerJson === "object" &&
    params.answerJson !== null &&
    "text" in params.answerJson
  ) {
    const text = (params.answerJson as { text?: unknown }).text;
    if (typeof text === "string") return text.trim();
  }
  return undefined;
}

function setNestedRuleValue(
  rule: ReturnType<typeof TradeRuleSchema.parse>,
  path: string,
  value: unknown,
) {
  const [parentKey, childKey] = path.split(".");
  if (!parentKey || !childKey) return;
  const parent = rule[parentKey as keyof typeof rule];
  if (typeof parent !== "object" || parent === null) return;
  (parent as Record<string, unknown>)[childKey] = value ?? undefined;
}

function buildThesisBreakers(answerJson: unknown): ThesisBreaker[] {
  if (typeof answerJson !== "object" || answerJson === null) return [];
  const value = answerJson as {
    values?: unknown;
    breakers?: unknown;
    value?: unknown;
  };
  const selected = Array.isArray(value.breakers)
    ? value.breakers
    : Array.isArray(value.values)
      ? value.values
      : Array.isArray(value.value)
        ? value.value
        : [];

  return selected
    .map((item): ThesisBreaker | null => {
      if (typeof item === "string" && item.trim()) {
        return {
          description: item.trim(),
          severity: "medium",
          newsKeywords: [],
        };
      }
      if (typeof item !== "object" || item === null) return null;
      const candidate = item as {
        description?: unknown;
        newsKeywords?: unknown;
      };
      if (typeof candidate.description !== "string") return null;
      const newsKeywords = Array.isArray(candidate.newsKeywords)
        ? candidate.newsKeywords.filter(
            (keyword): keyword is string =>
              typeof keyword === "string" && keyword.trim().length > 0,
          )
        : [];
      return {
        description: candidate.description.trim(),
        severity: "medium",
        newsKeywords,
      };
    })
    .filter((item): item is ThesisBreaker => item !== null)
    .slice(0, 10);
}
