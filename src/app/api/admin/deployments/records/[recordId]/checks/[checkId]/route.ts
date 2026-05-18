import { requireAdmin } from "@/lib/auth/require-admin";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { updateDeploymentCheck } from "@/features/deployment/services/deployment-check-service";
import { UpdateDeploymentCheckRequestSchema } from "@/schemas/deployment/deployment-schema";
import { validateJsonRequest } from "@/lib/api/validate-request";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ recordId: string; checkId: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const admin = await requireAdmin();
    const { checkId } = await params;
    const input = await validateJsonRequest(request, UpdateDeploymentCheckRequestSchema);
    const result = await updateDeploymentCheck({
      checkId,
      status: input.status,
      evidenceUrl: input.evidenceUrl,
      notes: input.notes,
      checkedBy: admin.id,
    });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}
