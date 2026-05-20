import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";
import { AppError } from "@/lib/errors/app-error";
import { runSafetyCheck } from "@/lib/safety/safety-check-service";
import type { CreateNotification } from "@/schemas/notifications/notification-schema";

export async function createNotification(
  params: {
    userId: string;
  } & CreateNotification,
) {
  const supabase = await createServerClient();

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

  const { data, error } = await supabase
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
  const supabase = await createServerClient();

  let query = supabase
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
  const supabase = await createServerClient();

  const { data: existing } = await supabase
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

  const { data, error } = await supabase
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
  const supabase = await createServerClient();

  const { data: existing } = await supabase
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

  const { data, error } = await supabase
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
