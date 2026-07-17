import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { AppError } from "@/lib/errors/app-error";
import { assertValidCronRequest } from "@/features/notifications/services/cron-auth-service";
import { createDatabaseClient } from "@/lib/db/database-client";
import { generateHolisticReview } from "@/features/portfolio/services/holistic-review-service";

export const MAX_REVIEWS_PER_RUN = 50;

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();

  try {
    assertValidCronRequest(request);
    const db = await createDatabaseClient();
    const { data: users, error } = await db
      .from("notification_preferences")
      .select("user_id")
      .eq("in_app_enabled", true)
      .limit(500);

    if (error) throw error;

    let processedCount = 0;
    let skippedForBudget = 0;
    let failedCount = 0;

    for (const user of users ?? []) {
      if (processedCount >= MAX_REVIEWS_PER_RUN) break;

      const { data: positions, error: positionsError } = await db
        .from("portfolio_positions")
        .select("id")
        .eq("user_id", user.user_id)
        .neq("position_status", "archived")
        .limit(1);
      if (positionsError) throw positionsError;
      if (!positions || positions.length === 0) continue;

      try {
        const result = await generateHolisticReview({
          userId: user.user_id,
          requestId,
        });
        if (result.created) processedCount += 1;
      } catch (error) {
        if (error instanceof AppError && error.code === "COST_LIMIT_EXCEEDED") {
          skippedForBudget += 1;
          continue;
        }

        // Daily execution makes provider/parse failures retryable on the next run
        // without preventing other users from receiving their review.
        failedCount += 1;
      }
    }

    return apiSuccess({
      processedCount,
      skippedForBudget,
      failedCount,
      maxReviewsPerRun: MAX_REVIEWS_PER_RUN,
    });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/cron/reviews/monthly",
      method: "GET",
    });
  }
}
