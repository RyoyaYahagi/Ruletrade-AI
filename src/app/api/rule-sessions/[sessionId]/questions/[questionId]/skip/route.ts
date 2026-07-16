import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { skipRuleQuestion } from "@/features/rules/services/rule-question-service";
import { assertOwnRuleSession } from "@/features/rules/services/rule-ownership-service";

export async function POST(
  _request: Request,
  {
    params,
  }: { params: Promise<{ sessionId: string; questionId: string }> },
) {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;
  try {
    const user = await requireUser();
    userId = user.id;
    const { sessionId, questionId } = await params;
    await assertOwnRuleSession({ userId: user.id, sessionId });
    const result = await skipRuleQuestion({
      userId: user.id,
      sessionId,
      questionId,
    });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/rule-sessions/[sessionId]/questions/[questionId]/skip",
      method: "POST",
    });
  }
}
