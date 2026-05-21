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
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminPermission(request);
    const { id } = await params;
    const body = await validateJsonRequest(
      request,
      UpdateTechnicalDebtStatusSchema,
    );
    const result = await updateTechnicalDebtStatus({
      debtItemId: id,
      status: body.status,
    });
    await logAdminAudit({
      action: "technical_debt_status_changed",
      details: { debtItemId: id, status: body.status },
    });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
