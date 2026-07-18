import { requireAdmin } from "@/lib/auth/require-admin";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { getAdminRuleAnalytics } from "@/features/rules/services/rule-analytics-service";
import { RuleAnalyticsQuerySchema } from "@/schemas/rules/rule-analytics-schema";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const parsed = RuleAnalyticsQuerySchema.parse({
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });
    const to = parsed.to ?? new Date().toISOString();
    const from =
      parsed.from ?? new Date(Date.parse(to) - 30 * 24 * 60 * 60 * 1000).toISOString();
    return apiSuccess(await getAdminRuleAnalytics({ from, to }));
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/admin/rule-analytics",
      method: "GET",
    });
  }
}
