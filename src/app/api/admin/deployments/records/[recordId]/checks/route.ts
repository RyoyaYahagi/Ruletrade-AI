import { requireAdmin } from "@/lib/auth/require-admin";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { listDeploymentChecks } from "@/features/deployment/services/deployment-check-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ recordId: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    await requireAdmin();
    const { recordId } = await params;
    const result = await listDeploymentChecks(recordId);
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}
