import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import {
  assertAiDeveloperSettingsEnabled,
  getAiDeveloperProviderOptions,
  getAiDeveloperSettings,
  updateAiDeveloperSettings,
} from "@/features/ai/services/ai-developer-settings-service";
import { AiDeveloperSettingsSchema } from "@/schemas/ai/ai-developer-settings-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;

  try {
    const user = await requireUser();
    userId = user.id;
    assertAiDeveloperSettingsEnabled();

    return apiSuccess({
      enabled: true,
      settings: await getAiDeveloperSettings({ userId: user.id }),
      providers: getAiDeveloperProviderOptions(),
    });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/ai/developer-settings",
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
    assertAiDeveloperSettingsEnabled();
    const settings = await validateJsonRequest(
      request,
      AiDeveloperSettingsSchema,
    );

    return apiSuccess(
      await updateAiDeveloperSettings({ userId: user.id, settings }),
    );
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/ai/developer-settings",
      method: "PATCH",
    });
  }
}
