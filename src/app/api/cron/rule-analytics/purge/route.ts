import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { assertValidCronRequest } from "@/features/notifications/services/cron-auth-service";
import { purgeExpiredRuleAnalyticsData } from "@/features/rules/services/rule-analytics-service";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    assertValidCronRequest(request);
    return apiSuccess(await purgeExpiredRuleAnalyticsData());
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/cron/rule-analytics/purge",
      method: "GET",
    });
  }
}
