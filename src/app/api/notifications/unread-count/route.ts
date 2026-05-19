import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { getUnreadNotificationCount } from "@/features/notifications/services/notification-service";

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const count = await getUnreadNotificationCount(user.id);
    return apiSuccess({ count });
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}
