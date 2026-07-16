import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { assertValidCronRequest } from "@/features/notifications/services/cron-auth-service";
import { fetchAndMatchRecentNews } from "@/features/news/services/news-fetch-service";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    assertValidCronRequest(request);
    return apiSuccess(await fetchAndMatchRecentNews({ sinceHours: 26 }));
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/cron/news/fetch",
      method: "GET",
    });
  }
}
