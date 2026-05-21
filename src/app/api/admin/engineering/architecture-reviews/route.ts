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
    await requireAdminPermission(request);
    const { searchParams } = new URL(request.url);
    const result = await listArchitectureReviewRequests({
      status: searchParams.get("status") ?? undefined,
      reviewArea: searchParams.get("reviewArea") ?? undefined,
      limit: searchParams.get("limit")
        ? Number(searchParams.get("limit"))
        : undefined,
    });
    return apiSuccess(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminPermission(request);
    const body = await validateJsonRequest(
      request,
      CreateArchitectureReviewRequestSchema,
    );
    const result = await createArchitectureReviewRequest(body);
    await logAdminAudit({
      action: "architecture_review_requested",
      details: { requestKey: body.requestKey, title: body.title },
    });
    return apiCreated(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
