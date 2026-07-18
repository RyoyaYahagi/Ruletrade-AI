import { requireUser } from "@/lib/auth/require-user";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { assertOwnRuleSession } from "@/features/rules/services/rule-ownership-service";
import { trackRuleEngagement } from "@/features/rules/services/rule-analytics-service";
import { TrackRuleEngagementRequestSchema } from "@/schemas/rules/rule-analytics-schema";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const { sessionId } = await params;
    await assertOwnRuleSession({ userId: user.id, sessionId });
    const input = await validateJsonRequest(
      request,
      TrackRuleEngagementRequestSchema,
    );
    const result = await trackRuleEngagement({
      userId: user.id,
      sessionId,
      ...input,
    });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/rule-sessions/[sessionId]/engagement",
      method: "POST",
    });
  }
}
