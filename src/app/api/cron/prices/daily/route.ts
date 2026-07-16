import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { createDatabaseClient } from "@/lib/db/database-client";
import { assertValidCronRequest } from "@/features/notifications/services/cron-auth-service";
import { detectPriceAlerts } from "@/features/notifications/services/price-alert-detection-service";

/**
 * 計画02が保存した日次 price_quotes を入力として、価格保存後の判定だけを行う。
 * 価格取得そのものをここで代替すると、未取得データを最新値として扱うため実装しない。
 */
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

    let alertCreatedCount = 0;
    let skippedRuleCount = 0;
    for (const row of users ?? []) {
      const result = await detectPriceAlerts({ userId: row.user_id });
      alertCreatedCount += result.createdCount;
      skippedRuleCount += result.skippedRuleCount;
    }

    return apiSuccess({ alertCreatedCount, skippedRuleCount });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/cron/prices/daily",
      method: "GET",
    });
  }
}
