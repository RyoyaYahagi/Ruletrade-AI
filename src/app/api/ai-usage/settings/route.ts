import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { validateJsonRequest } from "@/lib/api/validate-request";
import {
  getAiUsageSettings,
  updateAiUsageSettings,
} from "@/features/ai/services/ai-usage-service";
import { UpdateAiUsageSettingsSchema } from "@/schemas/ai/ai-usage-schema";

export async function GET() {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;

  try {
    const user = await requireUser();
    userId = user.id;
    return apiSuccess(await getAiUsageSettings(user.id));
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/ai-usage/settings",
      method: "GET",
    });
  }
}

export async function PUT(request: Request) {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;

  try {
    const user = await requireUser();
    userId = user.id;
    const input = await validateJsonRequest(request, UpdateAiUsageSettingsSchema);
    return apiSuccess(
      await updateAiUsageSettings({ userId: user.id, ...input }),
    );
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/ai-usage/settings",
      method: "PUT",
    });
  }
}
