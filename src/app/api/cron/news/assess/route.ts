import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { assertValidCronRequest } from "@/features/notifications/services/cron-auth-service";
import { assessNewsForAllUsers } from "@/features/news/services/news-assess-service";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    assertValidCronRequest(request);
    return apiSuccess(await assessNewsForAllUsers());
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/cron/news/assess",
      method: "GET",
    });
  }
}
