import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { dismissNotification } from "@/features/notifications/services/notification-service";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ notificationId: string }> },
) {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;

  try {
    const user = await requireUser();
    userId = user.id;

    const { notificationId } = await params;

    const result = await dismissNotification({
      userId: user.id,
      notificationId,
    });

    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/notifications/[notificationId]/dismiss",
      method: "PATCH",
    });
  }
}
