import "server-only";

import { createClient } from "@/lib/db/supabase-server";
import { AppError } from "@/lib/errors/app-error";
import { applyAnswerToRuleJson } from "@/features/rules/services/rule-draft-service";

export async function saveRuleAnswer(params: { userId: string; sessionId: string; questionId?: string; questionKey: string; answerText?: string; answerJson: unknown; }) {
  const supabase = await createClient();
  const { data: answer, error: answerError } = await supabase.from("rule_answers").insert({
    user_id: params.userId,
    session_id: params.sessionId,
    question_id: params.questionId ?? null,
    question_key: params.questionKey,
    answer_text: params.answerText ?? null,
    answer_json: params.answerJson,
  }).select("id").single();
  if (answerError || !answer) { throw new AppError("INTERNAL_ERROR", "回答の保存に失敗しました。", 500, answerError); }
  if (params.questionId) {
    await supabase.from("rule_questions").update({ status: "answered", answered_at: new Date().toISOString() }).eq("id", params.questionId).eq("user_id", params.userId);
  }
  const ruleJson = await applyAnswerToRuleJson({ userId: params.userId, sessionId: params.sessionId, questionKey: params.questionKey, answerJson: params.answerJson, answerText: params.answerText });
  return { answerId: answer.id, sessionId: params.sessionId, ruleJson };
}
