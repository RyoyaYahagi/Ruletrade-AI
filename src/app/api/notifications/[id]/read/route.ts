import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { markNotificationAsRead } from "@/features/notifications/services/notification-service";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { markNotificationReadSchema } from "@/schemas/notifications/notification-schema";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const { id } = await params;
    await validateJsonRequest(request, markNotificationReadSchema);
    const result = await markNotificationAsRead({
      userId: user.id,
      notificationId: id,
    });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}
