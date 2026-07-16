import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { runPortfolioReview } from "@/features/portfolio/services/portfolio-review-service";
import { runMeteredAiCall } from "@/lib/cost-limit/run-metered-ai-call";
import { ESTIMATED_AI_COST_USD } from "@/lib/cost-limit/cost-limit-types";

export async function POST() {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;

  try {
    const user = await requireUser();
    userId = user.id;

    const result = await runMeteredAiCall({
      userId: user.id,
      feature: "portfolio_review",
      estimatedCostUsd: ESTIMATED_AI_COST_USD.portfolio_review,
      execute: async () => ({
        result: await runPortfolioReview({
          userId: user.id,
          requestId,
        }),
        actualCostUsd: undefined,
      }),
    });

    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/portfolio/review",
      method: "POST",
    });
  }
}
