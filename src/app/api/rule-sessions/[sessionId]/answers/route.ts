import { requireUser } from "@/lib/auth/require-user";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { SaveRuleAnswerRequestSchema } from "@/schemas/api/rule-session-api-schema";
import { saveRuleAnswer } from "@/features/rules/services/rule-answer-service";
import { assertOwnRuleSession } from "@/features/rules/services/rule-ownership-service";

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const { sessionId } = await params;
    await assertOwnRuleSession({ userId: user.id, sessionId });
    const input = await validateJsonRequest(request, SaveRuleAnswerRequestSchema);
    const result = await saveRuleAnswer({ userId: user.id, sessionId, ...input });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, requestId);
  }
}
