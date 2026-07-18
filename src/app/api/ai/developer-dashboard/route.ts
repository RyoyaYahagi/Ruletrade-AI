import { requireUser } from "@/lib/auth/require-user";
import { apiCreated, apiSuccess } from "@/lib/api/api-response";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import {
  createAiExperimentNote,
  getAiDeveloperDashboard,
} from "@/features/ai/services/ai-observability-service";
import { assertAiDeveloperSettingsEnabled } from "@/features/ai/services/ai-developer-settings-service";
import { CreateAiExperimentSchema } from "@/schemas/ai/ai-experiment-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;

  try {
    const user = await requireUser();
    userId = user.id;
    assertAiDeveloperSettingsEnabled();
    return apiSuccess(await getAiDeveloperDashboard(user.id));
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/ai/developer-dashboard",
      method: "GET",
    });
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;

  try {
    const user = await requireUser();
    userId = user.id;
    assertAiDeveloperSettingsEnabled();
    const input = await validateJsonRequest(request, CreateAiExperimentSchema);
    return apiCreated(await createAiExperimentNote(user.id, input));
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/ai/developer-dashboard",
      method: "POST",
    });
  }
}
