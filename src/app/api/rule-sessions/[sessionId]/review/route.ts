import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { assertOwnRuleSession } from "@/features/rules/services/rule-ownership-service";
import { runRuleReview } from "@/features/rules/services/rule-review-service";
import { checkRateLimit } from "@/lib/rate-limit/check-rate-limit";
import { incrementRateLimit } from "@/lib/rate-limit/increment-rate-limit";
import { runMeteredAiCall } from "@/lib/cost-limit/run-metered-ai-call";
import { ESTIMATED_AI_COST_USD } from "@/lib/cost-limit/cost-limit-types";

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

    await checkRateLimit({
      userId: user.id,
      key: "ai_rule_review_hourly",
    });

    await checkRateLimit({
      userId: user.id,
      key: "ai_rule_review_daily",
    });

    const result = await runMeteredAiCall({
      userId: user.id,
      feature: "rule_review",
      estimatedCostUsd: ESTIMATED_AI_COST_USD.rule_review,
      execute: async () => {
        const result = await runRuleReview({
          userId: user.id,
          sessionId,
          requestId,
        });
        return {
          result,
          actualCostUsd: result.estimatedCostUsd,
        };
      },
    });

    await incrementRateLimit({
      userId: user.id,
      key: "ai_rule_review_hourly",
    });

    await incrementRateLimit({
      userId: user.id,
      key: "ai_rule_review_daily",
    });

    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: new URL(request.url).pathname,
      method: request.method,
    });
  }
}
