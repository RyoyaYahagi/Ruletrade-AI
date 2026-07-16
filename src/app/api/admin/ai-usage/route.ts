import { requireAdmin } from "@/lib/auth/require-admin";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { getAdminAiUsage } from "@/features/ai/services/ai-usage-service";

export async function GET() {
  const requestId = crypto.randomUUID();

  try {
    await requireAdmin();
    return apiSuccess(await getAdminAiUsage());
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/admin/ai-usage",
      method: "GET",
    });
  }
}
