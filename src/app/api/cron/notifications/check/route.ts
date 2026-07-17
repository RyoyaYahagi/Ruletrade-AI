import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { createDatabaseClient } from "@/lib/db/database-client";
import { assertValidCronRequest } from "@/features/notifications/services/cron-auth-service";
import { detectAndCreateReviewReminders } from "@/features/notifications/services/reminder-detection-service";
import { deliverQueuedInAppNotifications } from "@/features/notifications/services/notification-delivery-service";
import { detectPriceAlerts } from "@/features/notifications/services/price-alert-detection-service";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();

  try {
    assertValidCronRequest(request);

    const db = await createDatabaseClient();

    const { data: users, error } = await db
      .from("notification_preferences")
      .select("user_id")
      .eq("in_app_enabled", true)
      .limit(500);

    if (error) throw error;

    let createdCount = 0;
    let alertCreatedCount = 0;
    let skippedRuleCount = 0;

    for (const row of users ?? []) {
      const result = await detectAndCreateReviewReminders({
        userId: row.user_id,
      });
      createdCount += result.createdCount ?? 0;

      const alertResult = await detectPriceAlerts({ userId: row.user_id });
      alertCreatedCount += alertResult.createdCount;
      skippedRuleCount += alertResult.skippedRuleCount;
    }

    const deliveryResult = await deliverQueuedInAppNotifications({
      limit: 500,
    });

    return apiSuccess({
      createdCount,
      alertCreatedCount,
      skippedRuleCount,
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
