import "server-only";

import { createClient } from "@/lib/db/supabase-server";
import { AppError } from "@/lib/errors/app-error";
import { TradeRuleSchema } from "@/schemas/rules/trade-rule-schema";
import { createInitialQuestions } from "@/features/rules/services/rule-question-service";

export async function createRuleSession(params: { userId: string; ticker: string; companyName?: string; market?: string; currency?: string; templateKey?: string; }) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("rule_design_sessions").insert({
    user_id: params.userId,
    ticker: params.ticker,
    company_name: params.companyName ?? null,
    market: params.market ?? null,
    currency: params.currency ?? "JPY",
    template_key: params.templateKey ?? null,
    status: "in_progress",
    quality_gate_status: "not_reviewed",
    rule_json: {},
    question_count: 0,
    max_question_count: 12,
  }).select("id").single();
  if (error || !data) { throw new AppError("INTERNAL_ERROR", "ルール作成セッションの作成に失敗しました。", 500, error); }
  await createInitialQuestions({ userId: params.userId, sessionId: data.id });
  return { sessionId: data.id };
}

export async function listRuleSessions(params: { userId: string; }) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("rule_design_sessions").select("id, ticker, company_name, status, completion_score, quality_gate_status, question_count, max_question_count, created_at, updated_at").eq("user_id", params.userId).order("updated_at", { ascending: false });
  if (error) { throw new AppError("INTERNAL_ERROR", "ルール作成セッション一覧の取得に失敗しました。", 500, error); }
  return { sessions: data ?? [] };
}

export async function getRuleSessionDetail(params: { userId: string; sessionId: string; }) {
  const supabase = await createClient();
  const { data: session, error: sessionError } = await supabase.from("rule_design_sessions").select("*").eq("id", params.sessionId).eq("user_id", params.userId).single();
  if (sessionError || !session) { throw new AppError("NOT_FOUND", "ルール作成セッションが見つかりません。", 404); }
  const { data: questions } = await supabase.from("rule_questions").select("*").eq("session_id", params.sessionId).eq("user_id", params.userId).order("display_order", { ascending: true }).order("created_at", { ascending: true });
  const { data: answers } = await supabase.from("rule_answers").select("*").eq("session_id", params.sessionId).eq("user_id", params.userId).order("created_at", { ascending: true });
  const { data: latestReview } = await supabase.from("rule_reviews").select("*").eq("session_id", params.sessionId).eq("user_id", params.userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data: qualityChecks } = latestReview ? await supabase.from("rule_quality_checks").select("*").eq("review_id", latestReview.id).eq("user_id", params.userId) : { data: [] };
  return { session, questions: questions ?? [], answers: answers ?? [], latestReview: latestReview ?? null, qualityChecks: qualityChecks ?? [] };
}

export async function updateRuleSession(params: { userId: string; sessionId: string; status?: string; ruleJson?: unknown; }) {
  const supabase = await createClient();
  const updatePayload: Record<string, unknown> = {};
  if (params.status) updatePayload.status = params.status;
  if (params.ruleJson) updatePayload.rule_json = params.ruleJson;
  const { data, error } = await supabase.from("rule_design_sessions").update(updatePayload).eq("id", params.sessionId).eq("user_id", params.userId).select("id, status, rule_json, updated_at").single();
  if (error || !data) { throw new AppError("INTERNAL_ERROR", "ルール作成セッションの更新に失敗しました。", 500, error); }
  return { session: data };
}

export async function createRuleVersion(params: { userId: string; sessionId: string; ruleJson: unknown; changeReason: string; createdBy: "user" | "ai" | "system"; }) {
  const supabase = await createClient();
  const { data: latestVersion } = await supabase.from("rule_versions").select("version_number").eq("session_id", params.sessionId).eq("user_id", params.userId).order("version_number", { ascending: false }).limit(1).maybeSingle();
  const nextVersionNumber = (latestVersion?.version_number ?? 0) + 1;
  const { error } = await supabase.from("rule_versions").insert({ user_id: params.userId, session_id: params.sessionId, version_number: nextVersionNumber, rule_json: params.ruleJson, change_reason: params.changeReason, created_by: params.createdBy });
  if (error) { throw new AppError("INTERNAL_ERROR", "ルールバージョンの保存に失敗しました。", 500, error); }
}
