import { requireUser } from "@/lib/auth/require-user";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { assertOwnRuleSession } from "@/features/rules/services/rule-ownership-service";
import { FinalizeRuleSessionRequestSchema } from "@/schemas/api/rule-session-api-schema";
import { finalizeRuleSession } from "@/features/rules/services/rule-finalize-service";

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const { sessionId } = await params;
    await assertOwnRuleSession({ userId: user.id, sessionId });
    const input = await validateJsonRequest(request, FinalizeRuleSessionRequestSchema);
    const result = await finalizeRuleSession({ userId: user.id, sessionId, force: input.force });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, requestId);
  }
}
