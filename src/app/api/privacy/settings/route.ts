import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { PrivacySettingsSchema } from "@/schemas/privacy/privacy-settings-schema";
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
    const input = await validateJsonRequest(request, PrivacySettingsSchema);
    const result = await updatePrivacySettings({ userId: user.id, ...input });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/privacy/settings",
      method: "PATCH",
    });
  }
}
