import { requireAdmin } from "@/lib/auth/require-admin";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { listEnvironmentVariableInventory } from "@/features/deployment/services/environment-variable-inventory-service";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const environmentKey = url.searchParams.get("environmentKey") ?? undefined;
    const missingOnly = url.searchParams.get("missingOnly") === "true";
    const result = await listEnvironmentVariableInventory({ environmentKey, missingOnly });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}
