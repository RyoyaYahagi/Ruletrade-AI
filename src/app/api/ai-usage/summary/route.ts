import { requireUser } from "@/lib/auth/require-user";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { getAiUsageSummary } from "@/features/ai/services/ai-usage-service";

export async function GET() {
  const requestId = crypto.randomUUID();
  let userId: string | null = null;

  try {
    const user = await requireUser();
    userId = user.id;
    return apiSuccess(await getAiUsageSummary(user.id));
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId,
      route: "/api/ai-usage/summary",
      method: "GET",
    });
  }
}
