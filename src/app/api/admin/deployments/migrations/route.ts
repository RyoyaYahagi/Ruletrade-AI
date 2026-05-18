import { requireAdmin } from "@/lib/auth/require-admin";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { listDeploymentMigrationRecords } from "@/features/deployment/services/deployment-migration-service";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const deploymentRecordId = url.searchParams.get("deploymentRecordId");
    if (!deploymentRecordId) {
      throw new Error("deploymentRecordId is required");
    }
    const result = await listDeploymentMigrationRecords(deploymentRecordId);
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}
