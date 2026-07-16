import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { listHolisticReviews } from "@/features/portfolio/services/holistic-review-service";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;

  try {
    const user = await requireUser();
    userId = user.id;
    const period = new URL(request.url).searchParams.get("period") ?? undefined;
    return apiSuccess(await listHolisticReviews({ userId: user.id, period }));
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/portfolio/review/monthly",
      method: "GET",
    });
  }
}
