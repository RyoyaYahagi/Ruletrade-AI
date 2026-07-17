import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";
import { runSafetyCheck } from "@/lib/safety/safety-check-service";
import type { CreateNotification } from "@/schemas/notifications/notification-schema";

export async function createNotification(
  params: {
    userId: string;
  } & CreateNotification,
) {
  const db = await createDatabaseClient();

  let title = params.title;
  let body = params.body;
  let safetyPassed = true;

  const safetyResult = runSafetyCheck({
    text: `${params.title} ${params.body}`,
  });

  if (!safetyResult.passed) {
    title = "通知を確認してください";
    body = "新しい通知があります。アプリ内で詳細を確認できます。";
    safetyPassed = false;
  }

  const { data, error } = await db
    .from("notifications")
    .insert({
      user_id: params.userId,
      notification_type: params.notificationType,
      title,
      body,
      severity: params.severity ?? "info",
      target_type: params.targetType ?? null,
      target_id: params.targetId ?? null,
      action_url: params.actionUrl ?? null,
      metadata: params.metadata ?? {},
      safety_checked: true,
      safety_passed: safetyPassed,
      status: "queued",
      scheduled_for: params.scheduledFor ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError(
      "INTERNAL_ERROR",
      "通知の作成に失敗しました。",
      500,
      error,
    );
  }

  return { notification: data };
}

export async function listNotifications(params: {
  userId: string;
  limit?: number;
  status?: string;
}) {
  const db = await createDatabaseClient();

  let query = db
    .from("notifications")
    .select("*")
    .eq("user_id", params.userId)
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 50);

  if (params.status) {
    query = query.eq("status", params.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError(
      "INTERNAL_ERROR",
      "通知一覧の取得に失敗しました。",
      500,
      error,
    );
  }

  return { notifications: data ?? [] };
}

export async function markNotificationAsRead(params: {
  userId: string;
  notificationId: string;
}) {
  const db = await createDatabaseClient();

  const { data: existing } = await db
    .from("notifications")
    .select("id, user_id, status")
    .eq("id", params.notificationId)
    .single();

  if (!existing) {
    throw new AppError("NOT_FOUND", "通知が見つかりません。", 404);
  }

  if (existing.user_id !== params.userId) {
    throw new AppError("FORBIDDEN", "この通知にアクセスできません。", 403);
  }

  const { data, error } = await db
    .from("notifications")
    .update({
      status: "read",
      read_at: new Date().toISOString(),
    })
    .eq("id", params.notificationId)
    .eq("user_id", params.userId)
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError(
      "INTERNAL_ERROR",
      "通知の更新に失敗しました。",
      500,
      error,
    );
  }

  return { notification: data };
}

export async function dismissNotification(params: {
  userId: string;
  notificationId: string;
}) {
  const db = await createDatabaseClient();

  const { data: existing } = await db
    .from("notifications")
    .select("id, user_id")
    .eq("id", params.notificationId)
    .single();

  if (!existing) {
    throw new AppError("NOT_FOUND", "通知が見つかりません。", 404);
  }

  if (existing.user_id !== params.userId) {
    throw new AppError("FORBIDDEN", "この通知にアクセスできません。", 403);
  }

  const { data, error } = await db
    .from("notifications")
    .update({
      status: "dismissed",
      dismissed_at: new Date().toISOString(),
    })
    .eq("id", params.notificationId)
    .eq("user_id", params.userId)
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError(
      "INTERNAL_ERROR",
      "通知の更新に失敗しました。",
      500,
      error,
    );
  }

  return { notification: data };
}

export async function resolveRuleAlert(params: {
  userId: string;
  notificationId: string;
  resolution: "kept" | "revising";
}) {
  const db = await createDatabaseClient();
  const { data: notification, error: notificationError } = await db
    .from("notifications")
    .select("id, user_id")
    .eq("id", params.notificationId)
    .eq("user_id", params.userId)
    .single();
  if (notificationError || !notification) {
    throw new AppError("NOT_FOUND", "通知が見つかりません。", 404, notificationError);
  }

  const { data: event, error: eventError } = await db
    .from("rule_alert_events")
    .select("id")
    .eq("user_id", params.userId)
    .eq("notification_id", params.notificationId)
    .maybeSingle();
  if (eventError || !event) {
    throw new AppError("NOT_FOUND", "価格アラートが見つかりません。", 404, eventError);
  }

  const { error: resolutionError } = await db
    .from("rule_alert_events")
    .update({
      resolution: params.resolution,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", event.id)
    .eq("user_id", params.userId);
  if (resolutionError) {
    throw new AppError(
      "DATABASE_ERROR",
      "価格アラートの記録に失敗しました。",
      500,
      resolutionError,
    );
  }

  const { error: dismissError } = await db
    .from("notifications")
    .update({ status: "dismissed", dismissed_at: new Date().toISOString() })
    .eq("id", params.notificationId)
    .eq("user_id", params.userId);
  if (dismissError) {
    throw new AppError(
      "DATABASE_ERROR",
      "通知の更新に失敗しました。",
      500,
      dismissError,
    );
  }

  return { resolution: params.resolution, notificationId: params.notificationId };
}
