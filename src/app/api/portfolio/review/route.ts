import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { runPortfolioReview } from "@/features/portfolio/services/portfolio-review-service";
import { checkRateLimit } from "@/lib/rate-limit/check-rate-limit";
import { incrementRateLimit } from "@/lib/rate-limit/increment-rate-limit";
import { checkAiCostLimit } from "@/lib/cost-limit/check-ai-cost-limit";
import { incrementAiCostUsage } from "@/lib/cost-limit/increment-ai-cost-usage";
import { ESTIMATED_AI_RULE_REVIEW_COST_USD } from "@/lib/cost-limit/cost-limit-types";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;

  try {
    const user = await requireUser();
    userId = user.id;

    await checkRateLimit({
      userId: user.id,
      key: "portfolio_review_hourly",
    });

    await checkAiCostLimit({
      userId: user.id,
      estimatedNextCostUsd: ESTIMATED_AI_RULE_REVIEW_COST_USD,
    });

    const result = await runPortfolioReview({
      userId: user.id,
      requestId,
    });

    await incrementRateLimit({
      userId: user.id,
      key: "portfolio_review_hourly",
    });

    if (result.estimatedCostUsd) {
      await incrementAiCostUsage({
        userId: user.id,
        costUsd: result.estimatedCostUsd,
      });
    }

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
