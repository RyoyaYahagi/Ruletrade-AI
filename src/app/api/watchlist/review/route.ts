import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { checkRateLimit } from "@/lib/rate-limit/check-rate-limit";
import { incrementRateLimit } from "@/lib/rate-limit/increment-rate-limit";
import { checkAiCostLimit } from "@/lib/cost-limit/check-ai-cost-limit";
import { runWatchlistReview } from "@/features/watchlist/services/watchlist-review-service";

export async function POST() {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;

  try {
    const user = await requireUser();
    userId = user.id;

    await checkRateLimit({
      userId: user.id,
      key: "ai_rule_review_hourly",
    });

    await checkAiCostLimit({
      userId: user.id,
      estimatedNextCostUsd: 0.05,
    });

    const result = await runWatchlistReview({
      userId: user.id,
      requestId,
    });

    await incrementRateLimit({
      userId: user.id,
      key: "ai_rule_review_hourly",
    });

    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/watchlist/review",
      method: "POST",
    });
  }
}
