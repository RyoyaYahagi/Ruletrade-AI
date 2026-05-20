import { requireAdminPermission } from "@/features/admin/services/admin-auth-service";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { apiCreated, apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { logAdminAudit } from "@/features/admin/services/admin-audit-service";
import {
  createRiskAssessment,
  listRiskAssessmentsByReleasePlan,
} from "@/features/release/services/release-risk-service";
import { CreateRiskAssessmentRequestSchema } from "@/schemas/release/release-schema";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    await requireAdminPermission("admin.releases.read");
    const { id } = await params;
    const { data } = await listRiskAssessmentsByReleasePlan(id);
    return apiSuccess({ risks: data });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/admin/releases/[id]/risks",
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
    const admin = await requireAdminPermission("admin.releases.update");
    adminUserId = admin.user.id;
    const { id } = await params;
    const input = await validateJsonRequest(
      request,
      CreateRiskAssessmentRequestSchema,
    );
    const { releasePlanId: _, riskArea, riskLevel, ...rest } = input;
    const { data } = await createRiskAssessment({
      ...rest,
      risk_area: riskArea,
      risk_level: riskLevel,
      release_plan_id: id,
    });
    await logAdminAudit({
      adminUserId: admin.user.id,
      actionKey: "release_risk_created",
      targetType: "release_risk",
      targetId: data.id,
      result: "success",
      metadata: { riskArea: input.riskArea, riskLevel: input.riskLevel },
    });
    return apiCreated({ risk: data });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId: adminUserId,
      route: "/api/admin/releases/[id]/risks",
      method: "POST",
    });
  }
}
