import { requireAdminPermission } from "@/features/admin/services/admin-auth-service";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { apiCreated, apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import {
  createRoadmapItem,
  listRoadmapItems,
} from "@/features/release/services/roadmap-service";
import { CreateRoadmapItemRequestSchema } from "@/schemas/release/release-schema";
import { logAdminAudit } from "@/features/admin/services/admin-audit-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    await requireAdminPermission("admin.roadmap.read");
    const { data: items } = await listRoadmapItems({});
    return apiSuccess({ items });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/admin/roadmap",
      method: "GET",
    });
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let adminUserId: string | null = null;
  try {
    const admin = await requireAdminPermission("admin.roadmap.update");
    adminUserId = admin.user.id;
    const input = await validateJsonRequest(
      request,
      CreateRoadmapItemRequestSchema,
    );
    const result = await createRoadmapItem({
      item_key: input.itemKey,
      title: input.title,
      summary: input.summary,
      theme: input.theme,
      initiative: input.initiative,
      public_status: input.publicStatus,
      internal_status: input.internalStatus,
      priority: input.priority,
      target_milestone_key: input.targetMilestoneKey,
      target_release_key: input.targetReleaseKey,
      is_public: input.isPublic,
      sort_order: input.sortOrder,
      created_by: admin.user.id,
      updated_by: admin.user.id,
    });
    await logAdminAudit({
      adminUserId: admin.user.id,
      actionKey: "roadmap_item_created",
      targetType: "product_roadmap_item",
      targetId: result.data.id,
      result: "success",
      metadata: { itemKey: input.itemKey, title: input.title },
    });
    return apiCreated({ item: result.data });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId: adminUserId,
      route: "/api/admin/roadmap",
      method: "POST",
    });
  }
}
