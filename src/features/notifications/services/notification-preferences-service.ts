import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";

export async function getOrCreateNotificationPreferences(params: {
  userId: string;
}) {
  const db = await createDatabaseClient();

  const { data, error } = await db
    .from("notification_preferences")
    .select("*")
    .eq("user_id", params.userId)
    .maybeSingle();

  if (error) {
    throw new AppError(
      "INTERNAL_ERROR",
      "通知設定の取得に失敗しました。",
      500,
      error,
    );
  }

  if (data) {
    return { preferences: data };
  }

  const { data: created, error: createError } = await db
    .from("notification_preferences")
    .insert({
      user_id: params.userId,
    })
    .select("*")
    .single();

  if (createError || !created) {
    throw new AppError(
      "INTERNAL_ERROR",
      "通知設定の作成に失敗しました。",
      500,
      createError,
    );
  }

  return { preferences: created };
}

export async function updateNotificationPreferences(params: {
  userId: string;
  inAppEnabled?: boolean;
  webPushEnabled?: boolean;
  emailEnabled?: boolean;
  ruleReviewRemindersEnabled?: boolean;
  pendingQuestionsEnabled?: boolean;
  watchlistRemindersEnabled?: boolean;
  portfolioRemindersEnabled?: boolean;
  documentNotificationsEnabled?: boolean;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone?: string;
  maxNotificationsPerDay?: number;
}) {
  const db = await createDatabaseClient();

  const updatePayload: Record<string, unknown> = {};

  if (params.inAppEnabled !== undefined)
    updatePayload.in_app_enabled = params.inAppEnabled;
  if (params.webPushEnabled !== undefined)
    updatePayload.web_push_enabled = params.webPushEnabled;
  if (params.emailEnabled !== undefined)
    updatePayload.email_enabled = params.emailEnabled;
  if (params.ruleReviewRemindersEnabled !== undefined)
    updatePayload.rule_review_reminders_enabled =
      params.ruleReviewRemindersEnabled;
  if (params.pendingQuestionsEnabled !== undefined)
    updatePayload.pending_questions_enabled = params.pendingQuestionsEnabled;
  if (params.watchlistRemindersEnabled !== undefined)
    updatePayload.watchlist_reminders_enabled =
      params.watchlistRemindersEnabled;
  if (params.portfolioRemindersEnabled !== undefined)
    updatePayload.portfolio_reminders_enabled =
      params.portfolioRemindersEnabled;
  if (params.documentNotificationsEnabled !== undefined)
    updatePayload.document_notifications_enabled =
      params.documentNotificationsEnabled;
  if (params.quietHoursEnabled !== undefined)
    updatePayload.quiet_hours_enabled = params.quietHoursEnabled;
  if (params.quietHoursStart !== undefined)
    updatePayload.quiet_hours_start = params.quietHoursStart;
  if (params.quietHoursEnd !== undefined)
    updatePayload.quiet_hours_end = params.quietHoursEnd;
  if (params.timezone !== undefined) updatePayload.timezone = params.timezone;
  if (params.maxNotificationsPerDay !== undefined)
    updatePayload.max_notifications_per_day = params.maxNotificationsPerDay;

  const { data, error } = await db
    .from("notification_preferences")
    .upsert(
      {
        user_id: params.userId,
        ...updatePayload,
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError(
      "INTERNAL_ERROR",
      "通知設定の更新に失敗しました。",
      500,
      error,
    );
  }

  return { preferences: data };
}
