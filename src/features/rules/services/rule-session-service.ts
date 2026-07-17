import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";
import { getSqliteDatabase } from "@/lib/db/sqlite-client";
import type { RuleSessionSummary } from "@/features/rules/model";
import { TradeRuleSchema } from "@/schemas/rules/trade-rule-schema";
import { createInitialQuestions } from "@/features/rules/services/rule-question-service";

export async function createRuleSession(params: {
  userId: string;
  ticker: string;
  companyName?: string;
  market?: string;
  currency?: string;
  templateKey?: string;
}) {
  const db = await createDatabaseClient();
  const { data, error } = await db
    .from("rule_design_sessions")
    .insert({
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
      max_question_count: 10,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new AppError(
      "INTERNAL_ERROR",
      "ルール作成セッションの作成に失敗しました。",
      500,
      error,
    );
  }
  await createInitialQuestions({ userId: params.userId, sessionId: data.id });
  return { sessionId: data.id };
}

export async function listRuleSessions(params: { userId: string }) {
  const db = await createDatabaseClient();
  const { data, error } = await db
    .from("rule_design_sessions")
    .select(
      "id, ticker, company_name, status, completion_score, quality_gate_status, question_count, max_question_count, created_at, updated_at",
    )
    .eq("user_id", params.userId)
    .order("updated_at", { ascending: false });
  if (error) {
    throw new AppError(
      "INTERNAL_ERROR",
      "ルール作成セッション一覧の取得に失敗しました。",
      500,
      error,
    );
  }
  return { sessions: (data ?? []) as RuleSessionSummary[] };
}

export async function deleteRuleSession(params: {
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

  if (sessionError || !session) {
    throw new AppError(
      "NOT_FOUND",
      "削除するルールが見つかりません。",
      404,
      sessionError,
    );
  }

  const [versions, reviews, alertEvents, assessments] = await Promise.all([
    db
      .from("rule_versions")
      .select("id")
      .eq("session_id", params.sessionId)
      .eq("user_id", params.userId),
    db
      .from("rule_reviews")
      .select("id")
      .eq("session_id", params.sessionId)
      .eq("user_id", params.userId),
    db
      .from("rule_alert_events")
      .select("id, notification_id")
      .eq("session_id", params.sessionId)
      .eq("user_id", params.userId),
    db
      .from("news_assessments")
      .select("id, notification_id")
      .eq("session_id", params.sessionId)
      .eq("user_id", params.userId),
  ]);

  const lookupError = [versions, reviews, alertEvents, assessments].find(
    (result) => result.error,
  )?.error;
  if (lookupError) {
    throw new AppError(
      "DATABASE_ERROR",
      "ルールに紐づくデータの確認に失敗しました。",
      500,
      lookupError,
    );
  }

  const versionIds = getStringIds(versions.data);
  const reviewIds = getStringIds(reviews.data);
  const alertEventIds = getStringIds(alertEvents.data);
  const assessmentIds = getStringIds(assessments.data);
  const notificationIds = getStringIds(
    [...(alertEvents.data ?? []), ...(assessments.data ?? [])],
    "notification_id",
  );

  try {
    const sqlite = getSqliteDatabase();
    const tables = getExistingTables(sqlite);

    sqlite.transaction(() => {
      deleteRagSources(sqlite, tables, params.userId, "rule_session", [
        params.sessionId,
      ]);
      deleteRagSources(
        sqlite,
        tables,
        params.userId,
        "rule_version",
        versionIds,
      );
      deleteRagSources(sqlite, tables, params.userId, "rule_review", reviewIds);
      deleteRagSources(
        sqlite,
        tables,
        params.userId,
        "alert_resolution",
        alertEventIds,
      );
      deleteRagSources(
        sqlite,
        tables,
        params.userId,
        "news_assessment",
        assessmentIds,
      );

      deleteByNotificationIds(sqlite, tables, params.userId, notificationIds);
      deleteBySessionId(
        sqlite,
        tables,
        "rule_quality_checks",
        params.userId,
        params.sessionId,
      );
      deleteBySessionId(
        sqlite,
        tables,
        "rule_answers",
        params.userId,
        params.sessionId,
      );
      deleteBySessionId(
        sqlite,
        tables,
        "rule_questions",
        params.userId,
        params.sessionId,
      );
      deleteBySessionId(
        sqlite,
        tables,
        "rule_reviews",
        params.userId,
        params.sessionId,
      );
      deleteBySessionId(
        sqlite,
        tables,
        "rule_versions",
        params.userId,
        params.sessionId,
      );
      deleteBySessionId(
        sqlite,
        tables,
        "rule_alert_events",
        params.userId,
        params.sessionId,
      );
      deleteBySessionId(
        sqlite,
        tables,
        "news_assessments",
        params.userId,
        params.sessionId,
      );
      deleteById(
        sqlite,
        tables,
        "rule_design_sessions",
        params.userId,
        params.sessionId,
      );
    })();
  } catch (error) {
    throw new AppError(
      "INTERNAL_ERROR",
      "ルールの削除に失敗しました。",
      500,
      error,
    );
  }

  return { deleted: true };
}

export async function getRuleSessionDetail(params: {
  userId: string;
  sessionId: string;
}) {
  const db = await createDatabaseClient();
  const { data: session, error: sessionError } = await db
    .from("rule_design_sessions")
    .select("*")
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
  const { data: questions } = await db
    .from("rule_questions")
    .select("*")
    .eq("session_id", params.sessionId)
    .eq("user_id", params.userId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  const { data: answers } = await db
    .from("rule_answers")
    .select("*")
    .eq("session_id", params.sessionId)
    .eq("user_id", params.userId)
    .order("created_at", { ascending: true });
  const { data: latestReview } = await db
    .from("rule_reviews")
    .select("*")
    .eq("session_id", params.sessionId)
    .eq("user_id", params.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: qualityChecks } = latestReview
    ? await db
        .from("rule_quality_checks")
        .select("*")
        .eq("review_id", latestReview.id)
        .eq("user_id", params.userId)
    : { data: [] };
  const { data: latestFinancialStatement, error: financialStatementError } = await db
    .from("financial_statements")
    .select("*")
    .eq("ticker", session.ticker)
    .eq("market", session.market ?? "JP")
    .order("fiscal_period", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (financialStatementError) {
    throw new AppError(
      "DATABASE_ERROR",
      "最新の決算数値の取得に失敗しました。",
      500,
      financialStatementError,
    );
  }
  return {
    session,
    questions: questions ?? [],
    answers: answers ?? [],
    latestReview: latestReview ?? null,
    qualityChecks: qualityChecks ?? [],
    latestFinancialStatement: latestFinancialStatement ?? null,
  };
}

function getStringIds(rows: Array<Record<string, unknown>> | null, key = "id") {
  return (rows ?? [])
    .map((row) => row[key])
    .filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
}

function getExistingTables(sqlite: ReturnType<typeof getSqliteDatabase>) {
  return new Set(
    (
      sqlite
        .prepare("select name from sqlite_master where type = 'table'")
        .all() as Array<{ name: string }>
    ).map((row) => row.name),
  );
}

function deleteBySessionId(
  sqlite: ReturnType<typeof getSqliteDatabase>,
  tables: Set<string>,
  table: string,
  userId: string,
  sessionId: string,
) {
  if (!tables.has(table)) return;
  sqlite
    .prepare(`delete from "${table}" where user_id = ? and session_id = ?`)
    .run(userId, sessionId);
}

function deleteById(
  sqlite: ReturnType<typeof getSqliteDatabase>,
  tables: Set<string>,
  table: string,
  userId: string,
  id: string,
) {
  if (!tables.has(table)) return;
  sqlite
    .prepare(`delete from "${table}" where user_id = ? and id = ?`)
    .run(userId, id);
}

function deleteByNotificationIds(
  sqlite: ReturnType<typeof getSqliteDatabase>,
  tables: Set<string>,
  userId: string,
  notificationIds: string[],
) {
  if (notificationIds.length === 0) return;

  const placeholders = notificationIds.map(() => "?").join(", ");
  if (tables.has("notification_delivery_logs")) {
    sqlite
      .prepare(
        `delete from "notification_delivery_logs" where user_id = ? and notification_id in (${placeholders})`,
      )
      .run(userId, ...notificationIds);
  }
  if (tables.has("notifications")) {
    sqlite
      .prepare(
        `delete from "notifications" where user_id = ? and id in (${placeholders})`,
      )
      .run(userId, ...notificationIds);
  }
}

function deleteRagSources(
  sqlite: ReturnType<typeof getSqliteDatabase>,
  tables: Set<string>,
  userId: string,
  sourceType: string,
  sourceIds: string[],
) {
  if (sourceIds.length === 0) return;
  const placeholders = sourceIds.map(() => "?").join(", ");
  for (const table of ["rag_chunks", "rag_documents"]) {
    if (!tables.has(table)) continue;
    sqlite
      .prepare(
        `delete from "${table}" where user_id = ? and source_type = ? and source_id in (${placeholders})`,
      )
      .run(userId, sourceType, ...sourceIds);
  }
}

export async function updateRuleSession(params: {
  userId: string;
  sessionId: string;
  status?: string;
  ruleJson?: unknown;
}) {
  const db = await createDatabaseClient();

  const { data: currentSession, error: fetchError } = await db
    .from("rule_design_sessions")
    .select("status")
    .eq("id", params.sessionId)
    .eq("user_id", params.userId)
    .single();
  if (fetchError || !currentSession) {
    throw new AppError(
      "NOT_FOUND",
      "ルール作成セッションが見つかりません。",
      404,
    );
  }

  const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
    draft: ["in_progress", "archived"],
    in_progress: [
      "needs_more_info",
      "quality_gate_passed",
      "paused",
      "draft",
      "archived",
    ],
    needs_more_info: ["in_progress", "paused", "archived"],
    quality_gate_passed: ["finalized", "paused", "archived"],
    paused: ["in_progress", "draft", "archived"],
    finalized: ["archived"],
    archived: [],
  };

  if (params.status && params.status !== currentSession.status) {
    const allowed = VALID_STATUS_TRANSITIONS[currentSession.status] ?? [];
    if (!allowed.includes(params.status)) {
      throw new AppError(
        "VALIDATION_ERROR",
        `ステータス「${currentSession.status}」から「${params.status}」への遷移は許可されていません。`,
        400,
      );
    }
  }

  const updatePayload: Record<string, unknown> = {};
  if (params.status) updatePayload.status = params.status;
  if (params.ruleJson !== undefined) {
    const parseResult = TradeRuleSchema.safeParse(params.ruleJson);
    if (!parseResult.success) {
      throw new AppError(
        "VALIDATION_ERROR",
        "ruleJsonの形式が正しくありません。",
        400,
        parseResult.error.issues,
      );
    }
    updatePayload.rule_json = parseResult.data;
  }

  const { data, error } = await db
    .from("rule_design_sessions")
    .update(updatePayload)
    .eq("id", params.sessionId)
    .eq("user_id", params.userId)
    .select("id, status, rule_json, updated_at")
    .single();
  if (error || !data) {
    throw new AppError(
      "INTERNAL_ERROR",
      "ルール作成セッションの更新に失敗しました。",
      500,
      error,
    );
  }
  return { session: data };
}

export async function createRuleVersion(params: {
  userId: string;
  sessionId: string;
  ruleJson: unknown;
  changeReason: string;
  createdBy: "user" | "ai" | "system";
}) {
  const db = await createDatabaseClient();
  const { data: latestVersion } = await db
    .from("rule_versions")
    .select("version_number")
    .eq("session_id", params.sessionId)
    .eq("user_id", params.userId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersionNumber = (latestVersion?.version_number ?? 0) + 1;
  const { error } = await db.from("rule_versions").insert({
    user_id: params.userId,
    session_id: params.sessionId,
    version_number: nextVersionNumber,
    rule_json: params.ruleJson,
    change_reason: params.changeReason,
    created_by: params.createdBy,
  });
  if (error) {
    throw new AppError(
      "INTERNAL_ERROR",
      "ルールバージョンの保存に失敗しました。",
      500,
      error,
    );
  }
}

// TODO: buildRuleFromSession の実装詳細を決定する（セッションの回答とルールJSONから最終的なTradeRuleを構築）
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function buildRuleFromSession(_params: {
  userId: string;
  sessionId: string;
}) {
  // TODO: セッション情報、回答履歴、rule_json を統合して完全な TradeRule を構築する
  throw new AppError(
    "NOT_IMPLEMENTED",
    "buildRuleFromSession は未実装です。",
    501,
  );
}
