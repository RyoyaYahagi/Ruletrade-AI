import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { FeedbackVoteSchema } from "@/schemas/analytics/feedback-schema";
import { voteFeedback } from "@/features/analytics/services/feedback-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ feedbackId: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const { feedbackId } = await params;
    const body = await request.json();
    const input = FeedbackVoteSchema.parse({ ...body, feedbackId });
    const result = await voteFeedback({
      userId: user.id,
      feedbackId,
      voteType: input.voteType,
    });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/feedback/[feedbackId]/vote",
      method: "POST",
    });
  }
}
