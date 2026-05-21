export const dynamic = "force-dynamic";

import { requireAdminPermission } from "@/features/admin/services/admin-auth-service";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { apiCreated, apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { logAdminAudit } from "@/features/admin/services/admin-audit-service";
import { CreateArchitectureReviewRequestSchema } from "@/schemas/engineering/engineering-schema";
import {
  createArchitectureReviewRequest,
  listArchitectureReviewRequests,
} from "@/features/engineering/services/architecture-review-service";

export async function GET(request: Request) {
  try {
    const admin = await requireAdminPermission("admin.engineering.read");
    const { searchParams } = new URL(request.url);
    const result = await listArchitectureReviewRequests({
      status: searchParams.get("status") ?? undefined,
      reviewArea: searchParams.get("reviewArea") ?? undefined,
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
      CreateArchitectureReviewRequestSchema
    );
    const result = await createArchitectureReviewRequest({
      request_key: body.requestKey,
      title: body.title,
      description: body.description,
      review_area: body.reviewArea,
      risk_level: body.riskLevel,
      requires_adr: body.requiresAdr,
      requested_by: admin.user.id,
      metadata: {},
    });
    await logAdminAudit({
      adminUserId: admin.user.id,
      actionKey: "architecture_review_requested",
      targetType: "architecture_review",
      targetId: result.data?.id,
      metadata: { requestKey: body.requestKey, title: body.title },
    });
    return apiCreated(result.data);
  } catch (error) {
    return toErrorResponse(error, { requestId: crypto.randomUUID() });
  }
}
