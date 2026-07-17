import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";
import { applyAnswerToRuleJson } from "@/features/rules/services/rule-draft-service";

export async function saveRuleAnswer(params: {
  userId: string;
  sessionId: string;
  questionId?: string;
  questionKey: string;
  answerText?: string;
  answerJson: unknown;
  enteredBy?: "user" | "api_agent";
}) {
  const db = await createDatabaseClient();
  const answerJson = addAnswerOrigin(params.answerJson, params.enteredBy);
  const { data: answer, error: answerError } = await db
    .from("rule_answers")
    .insert({
      user_id: params.userId,
      session_id: params.sessionId,
      question_id: params.questionId ?? null,
      question_key: params.questionKey,
      answer_text: params.answerText ?? null,
      answer_json: answerJson,
    })
    .select("id")
    .single();
  if (answerError || !answer) {
    throw new AppError(
      "INTERNAL_ERROR",
      "回答の保存に失敗しました。",
      500,
      answerError,
    );
  }
  if (params.questionId) {
    const { error: questionError } = await db
      .from("rule_questions")
      .update({ status: "answered", answered_at: new Date().toISOString() })
      .eq("id", params.questionId)
      .eq("user_id", params.userId);
    if (questionError) {
      throw new AppError(
        "INTERNAL_ERROR",
        "質問の回答状態の更新に失敗しました。",
        500,
        questionError,
      );
    }
  }
  const ruleJson = await applyAnswerToRuleJson({
    userId: params.userId,
    sessionId: params.sessionId,
    questionKey: params.questionKey,
    answerJson,
    answerText: params.answerText,
  });
  return { answerId: answer.id, sessionId: params.sessionId, ruleJson };
}

function addAnswerOrigin(answerJson: unknown, enteredBy?: "user" | "api_agent") {
  if (!enteredBy) return answerJson;
  if (typeof answerJson !== "object" || answerJson === null || Array.isArray(answerJson)) {
    return { value: answerJson, enteredBy };
  }
  return { ...(answerJson as Record<string, unknown>), enteredBy };
}
