import { createServerClient } from "@/lib/db/supabase-server";
import {
  notificationSchema,
  type CreateNotificationInput,
  type Notification,
} from "@/schemas/notifications/notification-schema";

interface ListNotificationsParams {
  userId: string;
  limit?: number;
  unreadOnly?: boolean;
}

export async function listNotifications({
  userId,
  limit = 50,
  unreadOnly = false,
}: ListNotificationsParams): Promise<Notification[]> {
  const supabase = await createServerClient();

  let query = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    query = query.eq("is_read", false);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list notifications: ${error.message}`);
  }

  return (data ?? []).map((row) => notificationSchema.parse(row));
}

export async function getUnreadNotificationCount(
  userId: string,
): Promise<number> {
  const supabase = await createServerClient();

  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) {
    throw new Error(`Failed to count unread notifications: ${error.message}`);
  }

  return count ?? 0;
}

interface MarkAsReadParams {
  userId: string;
  notificationId: string;
}

export async function markNotificationAsRead({
  userId,
  notificationId,
}: MarkAsReadParams): Promise<Notification> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("id", notificationId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to mark notification as read: ${error.message}`);
  }

  if (!data) {
    throw new Error("Notification not found");
  }

  return notificationSchema.parse(data);
}

interface CreateNotificationParams extends CreateNotificationInput {
  userId: string;
}

export async function createNotification({
  userId,
  ...input
}: CreateNotificationParams): Promise<Notification> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_id: userId,
      type: input.type,
      title: input.title,
      body: input.body,
      action_url: input.action_url ?? null,
      is_read: false,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create notification: ${error.message}`);
  }

  return notificationSchema.parse(data);
}

interface DeleteNotificationParams {
  userId: string;
  notificationId: string;
}

export async function deleteNotification({
  userId,
  notificationId,
}: DeleteNotificationParams): Promise<void> {
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete notification: ${error.message}`);
  }
}
