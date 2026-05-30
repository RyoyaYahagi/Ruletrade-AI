import { requireAdminPermission } from "@/features/admin/services/admin-auth-service";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { apiCreated, apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import {
  createReleaseChangelogEntry,
  listChangelogEntriesByReleasePlan,
} from "@/features/release/services/release-changelog-service";
import { CreateChangelogEntryRequestSchema } from "@/schemas/release/release-schema";
import { logAdminAudit } from "@/features/admin/services/admin-audit-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    await requireAdminPermission("admin.changelog.read");
    const { id } = await params;
    const { data: entries } = await listChangelogEntriesByReleasePlan(id);
    return apiSuccess({ entries });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/admin/releases/[id]/changelog",
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
    const admin = await requireAdminPermission("admin.changelog.update");
    adminUserId = admin.user.id;
    const { id } = await params;
    const input = await validateJsonRequest(
      request,
      CreateChangelogEntryRequestSchema,
    );
    const result = await createReleaseChangelogEntry({
      releasePlanId: id,
      category: input.category,
      audience: input.audience,
      title: input.title,
      body: input.body,
      isBreakingChange: input.isBreakingChange,
      isPublicSafe: input.isPublicSafe,
      createdBy: admin.user.id,
    });
    await logAdminAudit({
      adminUserId: admin.user.id,
      actionKey: "release_changelog_entry_created",
      targetType: "release_plan",
      targetId: id,
      result: "success",
      metadata: { category: input.category, title: input.title },
    });
    return apiCreated({ entry: result.data });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId: adminUserId,
      route: "/api/admin/releases/[id]/changelog",
      method: "POST",
    });
  }
}
