import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";
import { createNotification } from "./notification-service";
import { getOrCreateNotificationPreferences } from "./notification-preferences-service";

export async function detectAndCreateReviewReminders(params: {
  userId: string;
}) {
  const { preferences } = await getOrCreateNotificationPreferences({
    userId: params.userId,
  });

  if (!preferences.in_app_enabled) {
    return { createdCount: 0, skippedReason: "in_app_disabled" };
  }

  // Rate limit check
  const supabase = await createServerClient();
  const today = new Date().toISOString().slice(0, 10);
  const { count: todayCount } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", params.userId)
    .gte("created_at", `${today}T00:00:00Z`);

  if ((todayCount ?? 0) >= preferences.max_notifications_per_day) {
    return { createdCount: 0, skippedReason: "daily_limit_reached" };
  }

  let createdCount = 0;

  if (preferences.pending_questions_enabled) {
    createdCount += await createPendingQuestionNotifications({
      userId: params.userId,
    });
  }

  if (preferences.rule_review_reminders_enabled) {
    createdCount += await createRuleQualityNotifications({
      userId: params.userId,
    });
  }

  if (preferences.watchlist_reminders_enabled) {
    createdCount += await createWatchlistNotifications({
      userId: params.userId,
    });
  }

  if (preferences.portfolio_reminders_enabled) {
    createdCount += await createPortfolioNotifications({
      userId: params.userId,
    });
  }

  return { createdCount };
}

async function createPendingQuestionNotifications(params: { userId: string }) {
  const supabase = await createServerClient();

  const { data: sessions, error } = await supabase
    .from("rule_design_sessions")
    .select("id, ticker, company_name")
    .eq("user_id", params.userId)
    .in("status", ["in_progress", "needs_more_info"])
    .limit(10);

  if (error) throw error;

  let count = 0;

  for (const session of sessions ?? []) {
    const { count: pendingCount } = await supabase
      .from("rule_questions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", params.userId)
      .eq("session_id", session.id)
      .eq("status", "pending");

    if (!pendingCount || pendingCount <= 0) continue;

    const alreadyExists = await hasRecentNotification({
      userId: params.userId,
      notificationType: "rule_questions_pending",
      targetType: "rule_session",
      targetId: session.id,
      cooldownHours: 24,
    });

    if (alreadyExists) continue;

    await createNotification({
      userId: params.userId,
      notificationType: "rule_questions_pending",
      title: "未回答の確認項目があります",
      body: `${session.ticker} の投資ルールに、まだ回答していない質問があります。`,
      severity: "info",
      targetType: "rule_session",
      targetId: session.id,
      actionUrl: `/rules/${session.id}`,
      metadata: { ticker: session.ticker, pendingCount },
    });

    count += 1;
  }

  return count;
}

async function createRuleQualityNotifications(params: { userId: string }) {
  const supabase = await createServerClient();

  const { data: sessions, error } = await supabase
    .from("rule_design_sessions")
    .select("id, ticker, company_name, completion_score, quality_gate_status")
    .eq("user_id", params.userId)
    .in("status", ["needs_more_info", "quality_gate_passed"])
    .limit(10);

  if (error) throw error;

  let count = 0;

  for (const session of sessions ?? []) {
    if (session.quality_gate_status === "needs_more_info") {
      const alreadyExists = await hasRecentNotification({
        userId: params.userId,
        notificationType: "rule_quality_gate_failed",
        targetType: "rule_session",
        targetId: session.id,
        cooldownHours: 24,
      });

      if (alreadyExists) continue;

      await createNotification({
        userId: params.userId,
        notificationType: "rule_quality_gate_failed",
        title: "ルールに未設定項目があります",
        body: `${session.ticker} の投資ルールには、まだ確認すべき項目があります。`,
        severity: "warning",
        targetType: "rule_session",
        targetId: session.id,
        actionUrl: `/rules/${session.id}`,
        metadata: {
          ticker: session.ticker,
          completionScore: session.completion_score,
        },
      });

      count += 1;
    }

    if (
      session.quality_gate_status === "passed" &&
      Number(session.completion_score ?? 0) >= 80
    ) {
      const alreadyExists = await hasRecentNotification({
        userId: params.userId,
        notificationType: "rule_finalizable",
        targetType: "rule_session",
        targetId: session.id,
        cooldownHours: 24,
      });

      if (alreadyExists) continue;

      await createNotification({
        userId: params.userId,
        notificationType: "rule_finalizable",
        title: "ルールを完成版として保存できます",
        body: `${session.ticker} の投資ルールは完成度が高くなっています。内容を確認して完成版として保存できます。`,
        severity: "success",
        targetType: "rule_session",
        targetId: session.id,
        actionUrl: `/rules/${session.id}`,
        metadata: {
          ticker: session.ticker,
          completionScore: session.completion_score,
        },
      });

      count += 1;
    }
  }

  return count;
}

async function createWatchlistNotifications(params: { userId: string }) {
  const supabase = await createServerClient();

  const { data: items, error } = await supabase
    .from("watchlist_items")
    .select("id, ticker, company_name, status, rule_session_id")
    .eq("user_id", params.userId)
    .in("status", ["ready_for_rule", "researching", "watching"])
    .is("rule_session_id", null)
    .limit(10);

  if (error) throw error;

  let count = 0;

  for (const item of items ?? []) {
    const alreadyExists = await hasRecentNotification({
      userId: params.userId,
      notificationType: "watchlist_item_needs_rule",
      targetType: "watchlist_item",
      targetId: item.id,
      cooldownHours: 48,
    });

    if (alreadyExists) continue;

    await createNotification({
      userId: params.userId,
      notificationType: "watchlist_item_needs_rule",
      title: "Watchlist候補をルール化できます",
      body: `${item.ticker} の候補メモを確認して、Rule Sessionに進めるか整理しましょう。`,
      severity: "info",
      targetType: "watchlist_item",
      targetId: item.id,
      actionUrl: `/watchlist/items/${item.id}`,
      metadata: { ticker: item.ticker },
    });

    count += 1;
  }

  return count;
}

async function createPortfolioNotifications(params: { userId: string }) {
  const supabase = await createServerClient();

  const { count: missingRulesCount, error } = await supabase
    .from("portfolio_positions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", params.userId)
    .eq("position_status", "active")
    .is("rule_session_id", null);

  if (error) throw error;

  if (!missingRulesCount || missingRulesCount <= 0) return 0;

  const alreadyExists = await hasRecentNotification({
    userId: params.userId,
    notificationType: "portfolio_missing_rules",
    targetType: "portfolio",
    cooldownHours: 24,
  });

  if (alreadyExists) return 0;

  await createNotification({
    userId: params.userId,
    notificationType: "portfolio_missing_rules",
    title: "ルール未設定の保有銘柄があります",
    body: `Portfolio内に、投資ルールがまだ紐づいていない保有銘柄が ${missingRulesCount} 件あります。`,
    severity: "warning",
    targetType: "portfolio",
    actionUrl: "/portfolio",
    metadata: { missingRulesCount },
  });

  return 1;
}

async function hasRecentNotification(params: {
  userId: string;
  notificationType: string;
  targetType?: string;
  targetId?: string;
  cooldownHours: number;
}) {
  const supabase = await createServerClient();

  const since = new Date(
    Date.now() - params.cooldownHours * 60 * 60 * 1000,
  ).toISOString();

  let query = supabase
    .from("notifications")
    .select("id")
    .eq("user_id", params.userId)
    .eq("notification_type", params.notificationType)
    .gte("created_at", since)
    .limit(1);

  if (params.targetType) {
    query = query.eq("target_type", params.targetType);
  }

  if (params.targetId) {
    query = query.eq("target_id", params.targetId);
  }

  const { data } = await query.maybeSingle();

  return Boolean(data);
}
