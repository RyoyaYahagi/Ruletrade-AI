import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";
import type {
  QuestionFeedbackInput,
  QuestionFeedbackRecord,
} from "@/schemas/rules/question-feedback-schema";

type QuestionRow = {
  id: string;
  question_key: string;
};

export async function getQuestionFeedback(params: {
  userId: string;
  sessionId: string;
  questionId: string;
}) {
  const db = await createDatabaseClient();
  const question = await getOwnedQuestion(db, params);
  const { data, error } = await db
    .from("rule_question_feedback")
    .select("*")
    .eq("user_id", params.userId)
    .eq("session_id", params.sessionId)
    .eq("question_id", question.id)
    .maybeSingle();
  if (error) {
    throw new AppError(
      "DATABASE_ERROR",
      "質問フィードバックの取得に失敗しました。",
      500,
      error,
    );
  }
  return { feedback: (data as QuestionFeedbackRecord | null) ?? null };
}

export async function saveQuestionFeedback(params: {
  userId: string;
  sessionId: string;
  input: QuestionFeedbackInput;
}) {
  const db = await createDatabaseClient();
  const question = await getOwnedQuestion(db, {
    userId: params.userId,
    sessionId: params.sessionId,
    questionId: params.input.questionId,
  });

  if (params.input.draftRunId) {
    const { data: run, error: runError } = await db
      .from("thesis_research_runs")
      .select("id")
      .eq("id", params.input.draftRunId)
      .eq("user_id", params.userId)
      .eq("session_id", params.sessionId)
      .maybeSingle();
    if (runError) {
      throw new AppError(
        "DATABASE_ERROR",
        "仮説下書きの実行情報を確認できませんでした。",
        500,
        runError,
      );
    }
    if (!run) {
      throw new AppError(
        "NOT_FOUND",
        "指定された仮説下書きの実行情報が見つかりません。",
        404,
      );
    }
  }

  const now = new Date().toISOString();
  const payload = {
    user_id: params.userId,
    session_id: params.sessionId,
    question_id: question.id,
    question_key: question.question_key,
    question_quality: params.input.questionQuality ?? null,
    choice_quality: params.input.choiceQuality ?? null,
    draft_effort: params.input.draftEffort ?? null,
    reason: params.input.reason?.trim() || null,
    draft_run_id: params.input.draftRunId ?? null,
    updated_at: now,
  };
  const { data: existing, error: existingError } = await db
    .from("rule_question_feedback")
    .select("id")
    .eq("user_id", params.userId)
    .eq("question_id", question.id)
    .maybeSingle();
  if (existingError) {
    throw new AppError(
      "DATABASE_ERROR",
      "既存の質問フィードバックを確認できませんでした。",
      500,
      existingError,
    );
  }
  const { data, error } = existing
    ? await db
        .from("rule_question_feedback")
        .update(payload)
        .eq("id", String(existing.id))
        .eq("user_id", params.userId)
        .select("*")
        .single()
    : await db
        .from("rule_question_feedback")
        .insert({ id: crypto.randomUUID(), ...payload })
        .select("*")
        .single();
  if (error || !data) {
    throw new AppError(
      "DATABASE_ERROR",
      "質問フィードバックの保存に失敗しました。",
      500,
      error,
    );
  }
  return { feedback: data as QuestionFeedbackRecord };
}

async function getOwnedQuestion(
  db: Awaited<ReturnType<typeof createDatabaseClient>>,
  params: { userId: string; sessionId: string; questionId: string },
) {
  const { data, error } = await db
    .from("rule_questions")
    .select("id, question_key")
    .eq("id", params.questionId)
    .eq("session_id", params.sessionId)
    .eq("user_id", params.userId)
    .single();
  if (error || !data) {
    throw new AppError(
      "NOT_FOUND",
      "フィードバック対象の質問が見つかりません。",
      404,
      error,
    );
  }
  return data as QuestionRow;
}
