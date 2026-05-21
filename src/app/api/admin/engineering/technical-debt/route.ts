export const dynamic = "force-dynamic";

import { requireAdminPermission } from "@/features/admin/services/admin-auth-service";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { apiCreated, apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { logAdminAudit } from "@/features/admin/services/admin-audit-service";
import { CreateTechnicalDebtRequestSchema } from "@/schemas/engineering/engineering-schema";
import {
  createTechnicalDebtItem,
  listTechnicalDebtItems,
} from "@/features/engineering/services/technical-debt-service";

export async function GET(request: Request) {
  try {
    const admin = await requireAdminPermission("admin.engineering.read");
    const { searchParams } = new URL(request.url);
    const result = await listTechnicalDebtItems({
      status: searchParams.get("status") ?? undefined,
      area: searchParams.get("area") ?? undefined,
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
      CreateTechnicalDebtRequestSchema
    );
    const result = await createTechnicalDebtItem({
      debt_key: body.debtKey,
      title: body.title,
      description: body.description,
      debt_type: body.debtType,
      priority: body.priority,
      severity: body.severity,
      area: body.area,
      target_milestone_key: body.targetMilestoneKey,
      target_release_key: body.targetReleaseKey,
      due_date: body.dueDate,
      accepted_until: body.acceptedUntil,
      repayment_plan: body.repaymentPlan,
      risk_if_not_fixed: body.riskIfNotFixed,
      related_issue_key: body.relatedIssueKey,
      related_adr_number: body.relatedAdrNumber ? String(body.relatedAdrNumber) : null,
      created_by: admin.user.id,
      metadata: body.metadata,
    });
    await logAdminAudit({
      adminUserId: admin.user.id,
      actionKey: "technical_debt_created",
      targetType: "technical_debt",
      targetId: result.data?.id,
      metadata: { debtKey: body.debtKey, title: body.title },
    });
    return apiCreated(result.data);
  } catch (error) {
    return toErrorResponse(error, { requestId: crypto.randomUUID() });
  }
}
