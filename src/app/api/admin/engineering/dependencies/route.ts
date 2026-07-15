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
    const admin = await requireAdminPermission("admin.engineering.read");
    const { searchParams } = new URL(request.url);
    const result = await listDependencyReviewItems({
      reviewStatus: searchParams.get("reviewStatus") ?? undefined,
      packageManager: searchParams.get("packageManager") ?? undefined,
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
      CreateDependencyReviewRequestSchema
    );
    const result = await createDependencyReviewItem({
      dependency_name: body.dependencyName,
      package_manager: body.packageManager,
      requested_version: body.requestedVersion ?? "",
      resolved_version: body.resolvedVersion,
      usage_reason: body.usageReason,
      alternatives_considered: body.alternativesConsidered,
      license_name: body.licenseName,
      source_url: body.sourceUrl,
      security_score: body.securityScore ? Number(body.securityScore) : null,
      known_vulnerability_count: body.knownVulnerabilityCount,
      is_runtime_dependency: body.isRuntimeDependency,
      is_client_bundle_dependency: body.isClientBundleDependency,
      requested_by: admin.user.id,
      metadata: {},
    });
    await logAdminAudit({
      adminUserId: admin.user.id,
      actionKey: "dependency_review_created",
      targetType: "dependency_review",
      targetId: result.data?.id,
      metadata: { dependencyName: body.dependencyName },
    });
    return apiCreated(result.data);
  } catch (error) {
    return toErrorResponse(error, { requestId: crypto.randomUUID() });
  }
}
