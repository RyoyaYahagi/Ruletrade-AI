import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { listTodayFeed } from "@/features/ux/services/today-feed-service";

export async function GET() {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;

  try {
    const user = await requireUser();
    userId = user.id;
    return apiSuccess(await listTodayFeed({ userId: user.id }));
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/today",
      method: "GET",
    });
  }
}
