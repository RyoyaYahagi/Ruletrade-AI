export const dynamic = "force-dynamic";

import { requireAdminPermission } from "@/features/admin/services/admin-auth-service";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { logAdminAudit } from "@/features/admin/services/admin-audit-service";
import { z } from "zod";
import { updateTechnicalDebtStatus } from "@/features/engineering/services/technical-debt-service";

const UpdateTechnicalDebtStatusSchema = z.object({
  status: z.enum([
    "open",
    "accepted",
    "in_progress",
    "paid_down",
    "wont_fix",
    "superseded",
  ]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminPermission("admin.engineering.update");
    const { id } = await params;
    const body = await validateJsonRequest(
      request,
      UpdateTechnicalDebtStatusSchema
    );
    const result = await updateTechnicalDebtStatus({
      debtItemId: id,
      status: body.status,
      actorUserId: admin.user.id,
    });
    await logAdminAudit({
      adminUserId: admin.user.id,
      actionKey: "technical_debt_status_changed",
      targetType: "technical_debt",
      targetId: id,
      metadata: { status: body.status },
    });
    return apiSuccess(result.data);
  } catch (error) {
    return toErrorResponse(error, { requestId: crypto.randomUUID() });
  }
}
