import { requireAdmin } from "@/lib/auth/require-admin";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { evaluateProductionDeploymentGate } from "@/features/deployment/services/production-deployment-gate-service";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    await requireAdmin();
    const body = await request.json();
    const result = await evaluateProductionDeploymentGate({
      releaseKey: body.releaseKey,
      deploymentRecordId: body.deploymentRecordId,
    });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}
