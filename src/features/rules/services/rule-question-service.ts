import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";
import { RULE_QUESTION_CATALOG } from "@/features/rules/constants/question-catalog";

export async function createInitialQuestions(params: {
  userId: string;
  sessionId: string;
}) {
  const db = await createDatabaseClient();
  const questions = RULE_QUESTION_CATALOG.map((question) => ({
    user_id: params.userId,
    session_id: params.sessionId,
    ...question,
  }));
  const { error } = await db.from("rule_questions").insert(questions);
  if (error) {
    throw new AppError(
      "INTERNAL_ERROR",
      "質問の作成に失敗しました。",
      500,
      error,
    );
  }
}

export async function getNextQuestion(params: {
  userId: string;
  sessionId: string;
}) {
  const db = await createDatabaseClient();
  const { data, error } = await db
    .from("rule_questions")
    .select("*")
    .eq("session_id", params.sessionId)
    .eq("user_id", params.userId)
    .eq("status", "pending")
    .order("display_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new AppError(
      "INTERNAL_ERROR",
      "次の質問の取得に失敗しました。",
      500,
      error,
    );
  }
  return { question: data ?? null };
}

export async function skipRuleQuestion(params: {
  userId: string;
  sessionId: string;
  questionId: string;
}) {
  const db = await createDatabaseClient();
  const { data, error } = await db
    .from("rule_questions")
    .update({ status: "skipped", answered_at: new Date().toISOString() })
    .eq("id", params.questionId)
    .eq("session_id", params.sessionId)
    .eq("user_id", params.userId)
    .eq("status", "pending")
    .select("id, status")
    .single();

  if (error || !data) {
    throw new AppError(
      "NOT_FOUND",
      "スキップする質問が見つかりません。",
      404,
      error,
    );
  }

  const { data: session, error: sessionError } = await db
    .from("rule_design_sessions")
    .select("question_count")
    .eq("id", params.sessionId)
    .eq("user_id", params.userId)
    .single();
  if (sessionError || !session) {
    throw new AppError(
      "DATABASE_ERROR",
      "質問の進捗更新に失敗しました。",
      500,
      sessionError,
    );
  }

  const { error: sessionUpdateError } = await db
    .from("rule_design_sessions")
    .update({ question_count: (session.question_count ?? 0) + 1 })
    .eq("id", params.sessionId)
    .eq("user_id", params.userId);
  if (sessionUpdateError) {
    throw new AppError(
      "DATABASE_ERROR",
      "質問の進捗更新に失敗しました。",
      500,
      sessionUpdateError,
    );
  }

  return { question: data };
}
