import { requireAdminPermission } from "@/features/admin/services/admin-auth-service";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { apiCreated, apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import {
  createReleaseChecklist,
  listChecklistsByReleasePlan,
  updateChecklistItemStatus,
} from "@/features/release/services/release-checklist-service";
import {
  CreateReleaseChecklistRequestSchema,
  UpdateChecklistItemStatusRequestSchema,
} from "@/schemas/release/release-schema";
import { logAdminAudit } from "@/features/admin/services/admin-audit-service";
import { z } from "zod";

/**
 * Extended schema for PATCH that includes checklistId and itemKey
 * to identify which checklist item to update.
 */
const UpdateChecklistItemStatusBodySchema =
  UpdateChecklistItemStatusRequestSchema.extend({
    checklistId: z.string().uuid(),
    itemKey: z.string().min(1),
  });

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    await requireAdminPermission("admin.releases.read");
    const { id } = await params;
    const { data: checklists } = await listChecklistsByReleasePlan(id);
    return apiSuccess({ checklists });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/admin/releases/[id]/checklist",
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
      CreateReleaseChecklistRequestSchema,
    );
    const result = await createReleaseChecklist({
      release_plan_id: id,
      checklist_key: input.checklistKey,
      title: input.title,
    });
    await logAdminAudit({
      adminUserId: admin.user.id,
      actionKey: "release_checklist_created",
      targetType: "release_plan",
      targetId: id,
      result: "success",
      metadata: { checklistKey: input.checklistKey, title: input.title },
    });
    return apiCreated({ checklist: result.data });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId: adminUserId,
      route: "/api/admin/releases/[id]/checklist",
      method: "POST",
    });
  }
}

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
      UpdateChecklistItemStatusBodySchema,
    );
    const result = await updateChecklistItemStatus(
      input.checklistId,
      input.itemKey,
      {
        status: input.status,
        notes: input.notes,
        checked_by: admin.user.id,
      },
    );
    await logAdminAudit({
      adminUserId: admin.user.id,
      actionKey: "release_checklist_item_status_updated",
      targetType: "release_plan",
      targetId: id,
      result: "success",
      metadata: {
        checklistId: input.checklistId,
        itemKey: input.itemKey,
        status: input.status,
      },
    });
    return apiSuccess({ item: result.data });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId: adminUserId,
      route: "/api/admin/releases/[id]/checklist",
      method: "PATCH",
    });
  }
}
