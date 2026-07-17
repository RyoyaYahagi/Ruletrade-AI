import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { assertValidCronRequest } from "@/features/notifications/services/cron-auth-service";
import { detectPriceAlerts } from "@/features/notifications/services/price-alert-detection-service";
import { detectDriftForAllPortfolios } from "@/features/portfolio/services/drift-alert-detection-service";
import { refreshDailyPrices } from "@/features/portfolio/services/price-daily-service";
import { createDatabaseClient } from "@/lib/db/database-client";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();

  try {
    assertValidCronRequest(request);
    const priceResult = await refreshDailyPrices();
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

    const driftResult = await detectDriftForAllPortfolios();
    return apiSuccess({
      ...priceResult,
      alertCreatedCount,
      skippedRuleCount,
      driftPortfolioCount: driftResult.portfolioCount,
      driftAlertCreatedCount: driftResult.createdCount,
    });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/cron/prices/daily",
      method: "GET",
    });
  }
}
