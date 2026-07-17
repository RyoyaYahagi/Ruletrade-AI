import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { assertOwnRuleSession } from "@/features/rules/services/rule-ownership-service";
import {
  applyFallbackBreakerCandidates,
  generateThesisDraft,
} from "@/features/rules/services/thesis-draft-service";
import { AppError } from "@/lib/errors/app-error";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;
  try {
    const user = await requireUser();
    userId = user.id;
    const { sessionId } = await params;
    await assertOwnRuleSession({ userId: user.id, sessionId });

    try {
      const result = await generateThesisDraft({
        userId: user.id,
        sessionId,
      });
      return apiSuccess({ ...result, fallbackUsed: false });
    } catch (error) {
      if (error instanceof AppError && error.code === "AI_OUTPUT_INVALID") {
        const breakerCandidates = await applyFallbackBreakerCandidates({
          userId: user.id,
          sessionId,
        });
        return apiSuccess({
          thesisDraft: "",
          breakerCandidates,
          fallbackUsed: true,
        });
      }
      throw error;
    }
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: new URL(request.url).pathname,
      method: request.method,
    });
  }
}
