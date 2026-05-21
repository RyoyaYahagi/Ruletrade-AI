export const dynamic = "force-dynamic";

import { requireAdminPermission } from "@/features/admin/services/admin-auth-service";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { apiCreated, apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { logAdminAudit } from "@/features/admin/services/admin-audit-service";
import { CreateEngineeringExceptionRequestSchema } from "@/schemas/engineering/engineering-schema";
import {
  createEngineeringException,
  listEngineeringExceptions,
} from "@/features/engineering/services/engineering-exception-service";

export async function GET(request: Request) {
  try {
    const admin = await requireAdminPermission("admin.engineering.read");
    const { searchParams } = new URL(request.url);
    const result = await listEngineeringExceptions({
      status: searchParams.get("status") ?? undefined,
      limit: searchParams.get("limit")
        ? Number(searchParams.get("limit"))
        : undefined,
    });
    return apiSuccess(result.data);
  } catch (error) {
    return toErrorResponse(error, { requestId: crypto.randomUUID() });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdminPermission("admin.engineering.update");
    const body = await validateJsonRequest(
      request,
      CreateEngineeringExceptionRequestSchema
    );
    const result = await createEngineeringException({
      exception_key: body.exceptionKey,
      title: body.title,
      description: body.description,
      exception_type: body.exceptionType,
      risk_level: body.riskLevel,
      requested_by: admin.user.id,
      expires_at: body.expiresAt,
      mitigation: body.mitigation,
      follow_up_debt_key: body.followUpDebtKey,
      related_issue_key: body.relatedIssueKey,
      metadata: body.metadata,
    });
    await logAdminAudit({
      adminUserId: admin.user.id,
      actionKey: "engineering_exception_created",
      targetType: "engineering_exception",
      targetId: result.data?.id,
      metadata: { exceptionKey: body.exceptionKey, title: body.title },
    });
    return apiCreated(result.data);
  } catch (error) {
    return toErrorResponse(error, { requestId: crypto.randomUUID() });
  }
}
