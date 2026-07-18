import { requireAdmin } from "@/lib/auth/require-admin";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { getAdminRuleTrace } from "@/features/rules/services/rule-analytics-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ traceId: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    await requireAdmin();
    const { traceId } = await params;
    return apiSuccess(await getAdminRuleTrace({ traceId }));
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/admin/rule-analytics/traces/[traceId]",
      method: "GET",
    });
  }
}
