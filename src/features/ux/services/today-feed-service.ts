import "server-only";

import {
  buildAttentionStatusMap,
  isApprovedRuleSession,
  isRuleReviewDue,
  isUnreadNotification,
  isUnresolvedAlert,
  loadAttentionStatusRecords,
  type AttentionStatus,
} from "@/features/ux/services/attention-status-service";

export type TodayFeedItem = {
  kind: "alert" | "news" | "review_due" | "pending_question" | "monthly_review";
  status: Exclude<AttentionStatus, "on_track">;
  title: string;
  href: string;
  createdAt: string;
};

export type TodayFeedResult = {
  items: TodayFeedItem[];
  stats: {
    positionsCount: number;
    rulesApproved: number;
    rulesNeedingCheck: number;
  };
};

export async function listTodayFeed(params: {
  userId: string;
  now?: Date;
}): Promise<TodayFeedResult> {
  const now = params.now ?? new Date();
  const records = await loadAttentionStatusRecords(params.userId);
  const statusMap = buildAttentionStatusMap(records, now);
  const sessionsById = new Map(records.sessions.map((session) => [session.id, session]));
  const items: TodayFeedItem[] = [];

  for (const alert of records.alerts.filter(isUnresolvedAlert)) {
    const sessionId = stringValue(
      alert.session_id ?? alert.rule_session_id ?? alert.target_id,
    );
    const session = sessionId ? sessionsById.get(sessionId) : undefined;
    items.push({
      kind: "alert",
      status: "condition_met",
      title: `${stringValue(alert.ticker ?? session?.ticker) || "ルール"} の条件が成立しました`,
      href: sessionId ? `/rules/${sessionId}` : "/portfolio",
      createdAt: stringValue(alert.created_at) || now.toISOString(),
    });
  }

  for (const notification of records.notifications.filter(
    (candidate) =>
      candidate.notification_type === "news_thesis_impact" &&
      isUnreadNotification(candidate),
  )) {
    items.push({
      kind: "news",
      status: "condition_met",
      title: stringValue(notification.title) || "ニュース確認事項があります",
      href: stringValue(notification.action_url) || "/notifications",
      createdAt: stringValue(notification.created_at) || now.toISOString(),
    });
  }

  const pendingBySession = new Map<string, number>();
  for (const question of records.questions) {
    if (question.status !== "pending") continue;
    const sessionId = stringValue(question.session_id);
    if (!sessionId) continue;
    pendingBySession.set(sessionId, (pendingBySession.get(sessionId) ?? 0) + 1);
  }
  for (const [sessionId, count] of pendingBySession) {
    const session = sessionsById.get(sessionId);
    if (!session) continue;
    items.push({
      kind: "pending_question",
      status: "needs_check",
      title: `${stringValue(session.ticker)} のルールに未回答の確認項目があります（${count}件）`,
      href: `/rules/${sessionId}`,
      createdAt: stringValue(session.updated_at) || now.toISOString(),
    });
  }

  for (const session of records.sessions) {
    if (!isRuleReviewDue(session, now)) continue;
    items.push({
      kind: "review_due",
      status: "needs_check",
      title: `${stringValue(session.ticker)} のルールを確認してください`,
      href: `/rules/${session.id}`,
      createdAt: stringValue(session.updated_at) || now.toISOString(),
    });
  }

  for (const notification of records.notifications.filter(
    (candidate) =>
      candidate.notification_type === "holistic_review_ready" &&
      isUnreadNotification(candidate),
  )) {
    items.push({
      kind: "monthly_review",
      status: "needs_check",
      title: stringValue(notification.title) || "今月の総合レビューを確認してください",
      href: stringValue(notification.action_url) || "/portfolio/review/monthly",
      createdAt: stringValue(notification.created_at) || now.toISOString(),
    });
  }

  items.sort((left, right) => {
    const statusOrder = { condition_met: 0, needs_check: 1 };
    const statusDifference = statusOrder[left.status] - statusOrder[right.status];
    if (statusDifference !== 0) return statusDifference;
    return Date.parse(right.createdAt) - Date.parse(left.createdAt);
  });

  const sessionStatuses = records.sessions.map(
    (session) => statusMap.get(session.id) ?? "needs_check",
  );

  return {
    items,
    stats: {
      positionsCount: records.positions.filter(
        (position) => position.position_status !== "archived",
      ).length,
      rulesApproved: records.sessions.filter(isApprovedRuleSession).length,
      rulesNeedingCheck: sessionStatuses.filter((status) => status === "needs_check").length,
    },
  };
}

export function sortTodayFeedItems(items: TodayFeedItem[]) {
  return [...items].sort((left, right) => {
    const statusOrder = { condition_met: 0, needs_check: 1 };
    const statusDifference = statusOrder[left.status] - statusOrder[right.status];
    if (statusDifference !== 0) return statusDifference;
    return Date.parse(right.createdAt) - Date.parse(left.createdAt);
  });
}

function stringValue(value: unknown) {
  return value == null ? "" : String(value);
}
