import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { UiPreferencesSchema } from "@/schemas/ux/ui-preferences-schema";
import {
  getOrCreateUiPreferences,
  updateUiPreferences,
} from "@/features/ux/services/ui-preferences-service";

export async function GET() {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;

  try {
    const user = await requireUser();
    userId = user.id;
    const result = await getOrCreateUiPreferences({ userId: user.id });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/ui/preferences",
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
    const input = await validateJsonRequest(
      request,
      UiPreferencesSchema.partial(),
    );
    const result = await updateUiPreferences({
      userId: user.id,
      locale: input.locale,
      timezone: input.timezone,
      colorScheme: input.colorScheme,
      reducedMotion: input.reducedMotion,
      highContrast: input.highContrast,
      largerText: input.largerText,
      compactMode: input.compactMode,
      showAdvancedFields: input.showAdvancedFields,
    });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/ui/preferences",
      method: "PATCH",
    });
  }
}
