import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";

export type AttentionStatus = "on_track" | "needs_check" | "condition_met";

export const REVIEW_DUE_DAYS = 90;

export type AttentionStatusRecords = {
  sessions: AttentionSessionRow[];
  questions: AttentionRow[];
  qualityChecks: AttentionRow[];
  alerts: AttentionRow[];
  notifications: AttentionRow[];
  positions: AttentionRow[];
};

export type AttentionSessionRow = AttentionRow & {
  id: string;
  ticker?: unknown;
  status?: unknown;
  quality_gate_status?: unknown;
  last_reviewed_at?: unknown;
};

export type AttentionRow = Record<string, unknown>;

export async function loadAttentionStatusRecords(
  userId: string,
): Promise<AttentionStatusRecords> {
  const db = await createDatabaseClient();
  const [sessions, questions, qualityChecks, alerts, notifications, positions] =
    await Promise.all([
      db.from("rule_design_sessions").select("*").eq("user_id", userId),
      db.from("rule_questions").select("*").eq("user_id", userId),
      db.from("rule_quality_checks").select("*").eq("user_id", userId),
      db.from("rule_alert_events").select("*").eq("user_id", userId),
      db.from("notifications").select("*").eq("user_id", userId),
      db.from("portfolio_positions").select("*").eq("user_id", userId),
    ]);

  const failed = [sessions, questions, qualityChecks, alerts, notifications, positions].find(
    (result) => result.error,
  );
  if (failed?.error) {
    throw new AppError(
      "DATABASE_ERROR",
      "確認状況の取得に失敗しました。",
      500,
      failed.error,
    );
  }

  return {
    sessions: (sessions.data ?? []) as AttentionSessionRow[],
    questions: (questions.data ?? []) as AttentionRow[],
    qualityChecks: (qualityChecks.data ?? []) as AttentionRow[],
    alerts: (alerts.data ?? []) as AttentionRow[],
    notifications: (notifications.data ?? []) as AttentionRow[],
    positions: (positions.data ?? []) as AttentionRow[],
  };
}

export async function getRuleAttentionStatus(params: {
  userId: string;
  sessionId: string;
}): Promise<AttentionStatus> {
  const records = await loadAttentionStatusRecords(params.userId);
  const session = records.sessions.find((candidate) => candidate.id === params.sessionId);
  if (!session) {
    throw new AppError("NOT_FOUND", "ルール作成セッションが見つかりません。", 404);
  }

  return evaluateAttentionStatus({
    session,
    position: records.positions.find(
      (position) => position.rule_session_id === params.sessionId,
    ),
    pendingQuestions: records.questions.filter(
      (question) =>
        question.session_id === params.sessionId && question.status === "pending",
    ),
    qualityChecks: records.qualityChecks.filter(
      (check) => check.session_id === params.sessionId,
    ),
    alerts: records.alerts.filter((alert) => belongsToSession(alert, params.sessionId)),
    notifications: records.notifications,
  });
}

export async function listAttentionStatuses(params: {
  userId: string;
}): Promise<Map<string, AttentionStatus>> {
  const records = await loadAttentionStatusRecords(params.userId);
  return buildAttentionStatusMap(records);
}

export function buildAttentionStatusMap(
  records: AttentionStatusRecords,
  now = new Date(),
): Map<string, AttentionStatus> {
  const statuses = new Map<string, AttentionStatus>();

  for (const session of records.sessions) {
    statuses.set(
      session.id,
      evaluateAttentionStatus({
        session,
        position: records.positions.find(
          (position) => position.rule_session_id === session.id,
        ),
        pendingQuestions: records.questions.filter(
          (question) =>
            question.session_id === session.id && question.status === "pending",
        ),
        qualityChecks: records.qualityChecks.filter(
          (check) => check.session_id === session.id,
        ),
        alerts: records.alerts.filter((alert) => belongsToSession(alert, session.id)),
        notifications: records.notifications,
        now,
      }),
    );
  }

  for (const position of records.positions) {
    const positionId = stringValue(position.id);
    const sessionId = stringValue(position.rule_session_id);
    const status = sessionId
      ? statuses.get(sessionId) ?? "needs_check"
      : "needs_check";
    if (positionId) statuses.set(positionId, status);
    const ticker = stringValue(position.ticker);
    if (ticker) statuses.set(ticker, status);
  }

  return statuses;
}

export function evaluateAttentionStatus(params: {
  session?: AttentionSessionRow;
  position?: AttentionRow;
  pendingQuestions: AttentionRow[];
  qualityChecks: AttentionRow[];
  alerts: AttentionRow[];
  notifications: AttentionRow[];
  now?: Date;
}): AttentionStatus {
  const hasUnresolvedAlert = params.alerts.some(isUnresolvedAlert);
  const hasUnreadNews = params.notifications.some(
    (notification) =>
      notification.notification_type === "news_thesis_impact" &&
      isUnreadNotification(notification),
  );
  if (hasUnresolvedAlert || hasUnreadNews) return "condition_met";

  const hasQualityWarning = params.qualityChecks.some((check) => {
    const status = stringValue(check.status);
    const severity = stringValue(check.severity);
    return ["warning", "fail", "failed", "blocked"].includes(status) ||
      ["warning", "medium", "high", "blocker"].includes(severity);
  });
  const hasPendingQuestion = params.pendingQuestions.length > 0;
  const reviewDue = params.session
    ? isRuleReviewDue(params.session, params.now)
    : false;
  const priceStale = Boolean(
    params.position?.price_stale ?? params.position?.is_price_stale,
  );

  if (hasQualityWarning || hasPendingQuestion || reviewDue || priceStale) {
    return "needs_check";
  }

  return "on_track";
}

export function isRuleReviewDue(
  session: AttentionSessionRow,
  now = new Date(),
) {
  const status = stringValue(session.status);
  if (status === "archived") return false;

  const rawLastReviewedAt = session.last_reviewed_at;
  if (rawLastReviewedAt == null || String(rawLastReviewedAt).trim() === "") {
    return status !== "draft";
  }

  const reviewedAt = Date.parse(String(rawLastReviewedAt));
  return (
    !Number.isFinite(reviewedAt) ||
    now.getTime() - reviewedAt > REVIEW_DUE_DAYS * 24 * 60 * 60 * 1000
  );
}

export function isApprovedRuleSession(session: AttentionSessionRow) {
  return (
    session.status === "finalized" ||
    session.quality_gate_status === "passed" ||
    session.quality_gate_status === "approved"
  );
}

export function isUnresolvedAlert(alert: AttentionRow) {
  const resolution = alert.resolution;
  const resolvedAt = alert.resolved_at;
  const status = stringValue(alert.status);
  return (
    resolution == null &&
    resolvedAt == null &&
    status !== "resolved" &&
    status !== "dismissed"
  );
}

export function isUnreadNotification(notification: AttentionRow) {
  const status = stringValue(notification.status);
  return status !== "read" && status !== "dismissed";
}

function belongsToSession(alert: AttentionRow, sessionId: string) {
  return (
    alert.session_id === sessionId ||
    alert.rule_session_id === sessionId ||
    alert.target_id === sessionId
  );
}

function stringValue(value: unknown) {
  return value == null ? "" : String(value);
}
