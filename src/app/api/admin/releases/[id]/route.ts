import { requireAdminPermission } from "@/features/admin/services/admin-auth-service";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { updateReleasePlanStatus } from "@/features/release/services/release-plan-service";
import { UpdateReleasePlanStatusRequestSchema } from "@/schemas/release/release-schema";
import { logAdminAudit } from "@/features/admin/services/admin-audit-service";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  let adminUserId: string | null = null;
  try {
    const admin = await requireAdminPermission("admin.releases.update");
    adminUserId = admin.user.id;
    const { id } = await params;
    const input = await validateJsonRequest(
      request,
      UpdateReleasePlanStatusRequestSchema,
    );
    const result = await updateReleasePlanStatus(id, {
      status: input.status,
      approved_by: input.status === "approved" ? admin.user.id : undefined,
    });
    await logAdminAudit({
      adminUserId: admin.user.id,
      actionKey: "release_plan_status_updated",
      targetType: "release_plan",
      targetId: id,
      result: "success",
      metadata: { status: input.status, notes: input.notes },
    });
    return apiSuccess({ release: result.data });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId: adminUserId,
      route: "/api/admin/releases/[id]",
      method: "PATCH",
    });
  }
}
