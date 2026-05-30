import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { listNotifications } from "@/features/notifications/services/notification-service";

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const result = await listNotifications({
      userId: user.id,
      status: "delivered",
    });
    const count = result.notifications.length;
    return apiSuccess({ count });
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}
