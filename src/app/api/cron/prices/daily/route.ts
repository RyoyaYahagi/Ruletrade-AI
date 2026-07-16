import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { assertValidCronRequest } from "@/features/notifications/services/cron-auth-service";
import { detectDriftForAllPortfolios } from "@/features/portfolio/services/drift-alert-detection-service";
import { refreshDailyPrices } from "@/features/portfolio/services/price-daily-service";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    assertValidCronRequest(request);
    const priceResult = await refreshDailyPrices();
    const driftResult = await detectDriftForAllPortfolios();
    return apiSuccess({ ...priceResult, ...driftResult });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/cron/prices/daily",
      method: "GET",
    });
  }
}
