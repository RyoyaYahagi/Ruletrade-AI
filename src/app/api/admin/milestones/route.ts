import { requireAdminPermission } from "@/features/admin/services/admin-auth-service";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { apiCreated, apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import {
  createMilestone,
  listMilestones,
} from "@/features/release/services/milestone-service";
import { CreateMilestoneRequestSchema } from "@/schemas/release/release-schema";
import { logAdminAudit } from "@/features/admin/services/admin-audit-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    await requireAdminPermission("admin.milestones.read");
    const { data: milestones } = await listMilestones({});
    return apiSuccess({ milestones });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/admin/milestones",
      method: "GET",
    });
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let adminUserId: string | null = null;
  try {
    const admin = await requireAdminPermission("admin.milestones.update");
    adminUserId = admin.user.id;
    const input = await validateJsonRequest(
      request,
      CreateMilestoneRequestSchema,
    );
    const result = await createMilestone({
      milestone_key: input.milestoneKey,
      title: input.title,
      description: input.description,
      phase: input.phase,
      target_date: input.targetDate,
      github_milestone_url: input.githubMilestoneUrl,
      github_project_url: input.githubProjectUrl,
      created_by: admin.user.id,
    });
    await logAdminAudit({
      adminUserId: admin.user.id,
      actionKey: "milestone_created",
      targetType: "internal_milestone",
      targetId: result.data.id,
      result: "success",
      metadata: { milestoneKey: input.milestoneKey, title: input.title },
    });
    return apiCreated({ milestone: result.data });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId: adminUserId,
      route: "/api/admin/milestones",
      method: "POST",
    });
  }
}
