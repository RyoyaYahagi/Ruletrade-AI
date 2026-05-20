import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";

export async function deliverQueuedInAppNotifications(params: {
  userId?: string;
  limit?: number;
}) {
  const supabase = await createServerClient();

  let query = supabase
    .from("notifications")
    .select("*")
    .eq("status", "queued")
    .or(`scheduled_for.is.null,scheduled_for.lte.${new Date().toISOString()}`)
    .order("created_at", { ascending: true })
    .limit(params.limit ?? 100);

  if (params.userId) {
    query = query.eq("user_id", params.userId);
  }

  const { data: notifications, error } = await query;

  if (error) {
    throw error;
  }

  let deliveredCount = 0;

  for (const notification of notifications ?? []) {
    const { error: updateError } = await supabase
      .from("notifications")
      .update({
        status: "delivered",
        delivered_at: new Date().toISOString(),
      })
      .eq("id", notification.id)
      .eq("user_id", notification.user_id);

    if (updateError) {
      await supabase.from("notification_delivery_logs").insert({
        user_id: notification.user_id,
        notification_id: notification.id,
        channel: "in_app",
        status: "failed",
        error_code: "DELIVERY_FAILED",
        error_message: updateError.message,
      });
      continue;
    }

    await supabase.from("notification_delivery_logs").insert({
      user_id: notification.user_id,
      notification_id: notification.id,
      channel: "in_app",
      status: "succeeded",
      provider: "in_app",
    });

    deliveredCount += 1;
  }

  return { deliveredCount };
}
