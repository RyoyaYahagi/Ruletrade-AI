import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { assertValidCronRequest } from "@/features/notifications/services/cron-auth-service";
import { detectDriftForAllPortfolios } from "@/features/portfolio/services/drift-alert-detection-service";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    assertValidCronRequest(request);
    // The price foundation supplies stored market values; this route performs the dependent monitoring pass.
    return apiSuccess(await detectDriftForAllPortfolios());
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/cron/prices/daily",
      method: "GET",
    });
  }
}
