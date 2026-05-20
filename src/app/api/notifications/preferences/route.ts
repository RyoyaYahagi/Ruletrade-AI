import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import {
  getOrCreateNotificationPreferences,
  updateNotificationPreferences,
} from "@/features/notifications/services/notification-preferences-service";

export async function GET() {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;

  try {
    const user = await requireUser();
    userId = user.id;

    const result = await getOrCreateNotificationPreferences({
      userId: user.id,
    });

    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/notifications/preferences",
      method: "GET",
    });
  }
}

export async function PATCH(request: Request) {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;

  try {
    const user = await requireUser();
    userId = user.id;

    const body = await request.json();

    const result = await updateNotificationPreferences({
      userId: user.id,
      ...body,
    });

    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/notifications/preferences",
      method: "PATCH",
    });
  }
}
