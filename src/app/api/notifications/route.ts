import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import {
  listNotifications,
  createNotification,
} from "@/features/notifications/services/notification-service";
import { createNotificationSchema } from "@/schemas/notifications/notification-schema";
import { validateJsonRequest } from "@/lib/api/validate-request";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread_only") === "true";
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);

    const result = await listNotifications({
      userId: user.id,
      unreadOnly,
      limit,
    });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const input = await validateJsonRequest(request, createNotificationSchema);
    const result = await createNotification({
      userId: user.id,
      ...input,
    });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}
