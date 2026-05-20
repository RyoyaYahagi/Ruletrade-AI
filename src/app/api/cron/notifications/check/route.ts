import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { createServerClient } from "@/lib/db/supabase-server";
import { assertValidCronRequest } from "@/features/notifications/services/cron-auth-service";
import { detectAndCreateReviewReminders } from "@/features/notifications/services/reminder-detection-service";
import { deliverQueuedInAppNotifications } from "@/features/notifications/services/notification-delivery-service";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();

  try {
    assertValidCronRequest(request);

    const supabase = await createServerClient();

    const { data: users, error } = await supabase
      .from("notification_preferences")
      .select("user_id")
      .eq("in_app_enabled", true)
      .limit(500);

    if (error) throw error;

    let createdCount = 0;

    for (const row of users ?? []) {
      const result = await detectAndCreateReviewReminders({
        userId: row.user_id,
      });
      createdCount += result.createdCount ?? 0;
    }

    const deliveryResult = await deliverQueuedInAppNotifications({
      limit: 500,
    });

    return apiSuccess({
      createdCount,
      deliveredCount: deliveryResult.deliveredCount,
    });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/cron/notifications/check",
      method: "GET",
    });
  }
}
