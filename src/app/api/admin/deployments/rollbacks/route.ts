import { requireAdmin } from "@/lib/auth/require-admin";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { listRollbackRecords, createRollbackRecord } from "@/features/deployment/services/rollback-record-service";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const deploymentRecordId = url.searchParams.get("deploymentRecordId") ?? undefined;
    const result = await listRollbackRecords({ deploymentRecordId });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const result = await createRollbackRecord({
      deploymentRecordId: body.deploymentRecordId,
      rollbackKey: body.rollbackKey,
      rollbackType: body.rollbackType,
      reason: body.reason,
      impactSummary: body.impactSummary,
      executedBy: admin.id,
    });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error, { requestId });
  }
}
