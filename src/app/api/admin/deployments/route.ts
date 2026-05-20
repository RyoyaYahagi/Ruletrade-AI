import { requireAdmin } from "@/lib/auth/require-admin";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { listDeploymentEnvironments } from "@/features/deployment/services/deployment-environment-service";

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    await requireAdmin();
    const result = await listDeploymentEnvironments();
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}
