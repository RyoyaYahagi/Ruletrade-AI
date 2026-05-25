import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import {
  getOrCreatePrivacySettings,
  updatePrivacySettings,
} from "@/features/privacy/services/privacy-settings-service";

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const result = await getOrCreatePrivacySettings({ userId: user.id });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/privacy/settings",
      method: "GET",
    });
  }
}

export async function PATCH(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const user = await requireUser();
    const body = await request.json();
    const { userId: _bodyUserId, ...safeBody } = body;
    const result = await updatePrivacySettings({ userId: user.id, ...safeBody });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/privacy/settings",
      method: "PATCH",
    });
  }
}
