export const dynamic = "force-dynamic";

import { requireAdminPermission } from "@/features/admin/services/admin-auth-service";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { apiCreated, apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { logAdminAudit } from "@/features/admin/services/admin-audit-service";
import { CreateDependencyReviewRequestSchema } from "@/schemas/engineering/engineering-schema";
import {
  createDependencyReviewItem,
  listDependencyReviewItems,
} from "@/features/engineering/services/dependency-review-service";

export async function GET(request: Request) {
  try {
    await requireAdminPermission(request);
    const { searchParams } = new URL(request.url);
    const result = await listDependencyReviewItems({
      reviewStatus: searchParams.get("reviewStatus") ?? undefined,
      packageManager: searchParams.get("packageManager") ?? undefined,
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
      CreateDependencyReviewRequestSchema,
    );
    const result = await createDependencyReviewItem(body);
    await logAdminAudit({
      action: "dependency_review_created",
      details: { dependencyName: body.dependencyName },
    });
    return apiCreated(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
