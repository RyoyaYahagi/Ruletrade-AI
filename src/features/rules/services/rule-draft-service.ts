import "server-only";

import { createClient } from "@/lib/db/supabase-server";
import { AppError } from "@/lib/errors/app-error";
import { TradeRuleSchema } from "@/schemas/rules/trade-rule-schema";

export async function applyAnswerToRuleJson(params: { userId: string; sessionId: string; questionKey: string; answerJson: unknown; answerText?: string; }) {
  const supabase = await createClient();
  const { data: session, error: sessionError } = await supabase.from("rule_design_sessions").select("id, rule_json, question_count").eq("id", params.sessionId).eq("user_id", params.userId).single();
  if (sessionError || !session) { throw new AppError("NOT_FOUND", "ルール作成セッションが見つかりません。", 404); }
  const currentRule = TradeRuleSchema.parse(session.rule_json ?? {});
  const nextRule = structuredClone(currentRule);
  switch (params.questionKey) {
    case "investment_thesis": nextRule.investmentThesis = params.answerText; break;
    case "time_horizon":
      if (typeof params.answerJson === "object" && params.answerJson !== null && "value" in params.answerJson) {
        nextRule.timeHorizon = String((params.answerJson as { value: unknown }).value) as typeof nextRule.timeHorizon;
      }
      break;
    case "entry_price_range":
      if (typeof params.answerJson === "object" && params.answerJson !== null) {
        const value = params.answerJson as { min?: number; max?: number; currency?: string };
        nextRule.entryPlan = { ...nextRule.entryPlan, targetPriceMin: value.min, targetPriceMax: value.max, currency: (value.currency as typeof nextRule.entryPlan.currency) ?? "JPY" };
      }
      break;
    case "stop_loss_rule": nextRule.riskManagement = { ...nextRule.riskManagement, stopLossRule: params.answerText }; break;
    default: nextRule.freeNotes = [nextRule.freeNotes, params.answerText].filter(Boolean).join("\n"); break;
  }
  const parsed = TradeRuleSchema.parse(nextRule);
  const { data, error } = await supabase.from("rule_design_sessions").update({ rule_json: parsed, question_count: (session.question_count ?? 0) + 1, status: "in_progress" }).eq("id", params.sessionId).eq("user_id", params.userId).select("rule_json").single();
  if (error || !data) { throw new AppError("INTERNAL_ERROR", "ルール草案の更新に失敗しました。", 500, error); }
  return data.rule_json;
}
