import { apiSuccess } from "@/lib/api/api-response";
import { requireUser } from "@/lib/auth/require-user";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { AppError } from "@/lib/errors/app-error";
import { assertOwnRuleSession } from "@/features/rules/services/rule-ownership-service";
import {
  getQuestionFeedback,
  saveQuestionFeedback,
} from "@/features/rules/services/rule-question-feedback-service";
import { QuestionFeedbackInputSchema } from "@/schemas/rules/question-feedback-schema";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const { sessionId } = await params;
    await assertOwnRuleSession({ userId: user.id, sessionId });
    const questionId = new URL(request.url).searchParams.get("questionId");
    if (!questionId) {
      throw new AppError(
        "VALIDATION_ERROR",
        "questionIdを指定してください。",
        400,
      );
    }
    return apiSuccess(
      await getQuestionFeedback({
        userId: user.id,
        sessionId,
        questionId,
      }),
    );
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const { sessionId } = await params;
    await assertOwnRuleSession({ userId: user.id, sessionId });
    const input = await validateJsonRequest(request, QuestionFeedbackInputSchema);
    return apiSuccess(
      await saveQuestionFeedback({
        userId: user.id,
        sessionId,
        input,
      }),
    );
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}
