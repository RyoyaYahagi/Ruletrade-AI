import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { getRuleSessionDetail, updateRuleSession } from "@/features/rules/services/rule-session-service";
import { assertOwnRuleSession } from "@/features/rules/services/rule-ownership-service";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { UpdateRuleSessionRequestSchema } from "@/schemas/api/rule-session-api-schema";

export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const { sessionId } = await params;
    await assertOwnRuleSession({ userId: user.id, sessionId });
    const result = await getRuleSessionDetail({ userId: user.id, sessionId });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, requestId);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const { sessionId } = await params;
    await assertOwnRuleSession({ userId: user.id, sessionId });
    const input = await validateJsonRequest(request, UpdateRuleSessionRequestSchema);
    const result = await updateRuleSession({ userId: user.id, sessionId, ...input });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, requestId);
  }
}
