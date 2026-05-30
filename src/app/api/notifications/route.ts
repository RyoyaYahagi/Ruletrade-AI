import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { listNotifications } from "@/features/notifications/services/notification-service";

export async function GET() {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;

  try {
    const user = await requireUser();
    userId = user.id;

    const result = await listNotifications({
      userId: user.id,
      limit: 50,
    });

    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/notifications",
      method: "GET",
    });
  }
}
