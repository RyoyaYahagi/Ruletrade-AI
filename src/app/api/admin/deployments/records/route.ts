import { requireAdmin } from "@/lib/auth/require-admin";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { listDeploymentRecords, createDeploymentRecord } from "@/features/deployment/services/deployment-record-service";
import { CreateDeploymentRecordRequestSchema } from "@/schemas/deployment/deployment-schema";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { getDeploymentEnvironmentByKey } from "@/features/deployment/services/deployment-environment-service";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const environmentKey = url.searchParams.get("environmentKey") ?? undefined;
    const result = await listDeploymentRecords({ environmentKey });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const admin = await requireAdmin();
    const input = await validateJsonRequest(request, CreateDeploymentRecordRequestSchema);
    const { environment } = await getDeploymentEnvironmentByKey(input.environmentKey);
    const result = await createDeploymentRecord({
      deploymentKey: input.deploymentKey,
      environmentId: environment.id,
      releaseKey: input.releaseKey,
      version: input.version,
      deploymentUrl: input.deploymentUrl,
      branchName: input.branchName,
      commitSha: input.commitSha,
      pullRequestUrl: input.pullRequestUrl,
      includesDbMigration: input.includesDbMigration,
      includesEnvChange: input.includesEnvChange,
      includesFeatureFlagChange: input.includesFeatureFlagChange,
      metadata: input.metadata,
      deployedBy: admin.id,
    });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}
