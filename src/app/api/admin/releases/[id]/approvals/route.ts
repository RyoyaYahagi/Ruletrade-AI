import { requireAdminPermission } from "@/features/admin/services/admin-auth-service";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { apiCreated, apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import {
  createReleaseApproval,
  listApprovalsByReleasePlan,
} from "@/features/release/services/release-approval-service";
import { CreateReleaseApprovalRequestSchema } from "@/schemas/release/release-schema";
import { logAdminAudit } from "@/features/admin/services/admin-audit-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    await requireAdminPermission("admin.releases.read");
    const { id } = await params;
    const { data: approvals } = await listApprovalsByReleasePlan(id);
    return apiSuccess({ approvals });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/admin/releases/[id]/approvals",
      method: "GET",
    });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  let adminUserId: string | null = null;
  try {
    const admin = await requireAdminPermission("admin.releases.approve");
    adminUserId = admin.user.id;
    const { id } = await params;
    const input = await validateJsonRequest(
      request,
      CreateReleaseApprovalRequestSchema,
    );
    const result = await createReleaseApproval({
      release_plan_id: id,
      approver_user_id: admin.user.id,
      approval_type: input.approvalType,
      comment: input.comment,
    });
    await logAdminAudit({
      adminUserId: admin.user.id,
      actionKey: "release_approval_created",
      targetType: "release_plan",
      targetId: id,
      result: "success",
      metadata: { approvalType: input.approvalType },
    });
    return apiCreated({ approval: result.data });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId: adminUserId,
      route: "/api/admin/releases/[id]/approvals",
      method: "POST",
    });
  }
}
