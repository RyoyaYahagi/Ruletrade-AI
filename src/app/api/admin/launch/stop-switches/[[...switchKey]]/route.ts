import { requireAdminPermission } from "@/features/admin/services/admin-auth-service";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { UpdateStopSwitchSchema } from "@/schemas/launch/beta-schema";
import { createServerClient } from "@/lib/db/supabase-server";
import { logAdminAudit } from "@/features/admin/services/admin-audit-service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ switchKey?: string[] }> },
) {
  const requestId = crypto.randomUUID();
  let adminUserId: string | null = null;
  try {
    const admin = await requireAdminPermission("admin.stop_switch.update");
    adminUserId = admin.user.id;
    const { switchKey } = await params;
    const key = switchKey?.[0];
    if (!key) {
      return toErrorResponse(new Error("switchKey is required."), {
        requestId,
        userId: adminUserId,
        route: "/api/admin/launch/stop-switches",
        method: "PATCH",
      });
    }
    const input = await validateJsonRequest(request, UpdateStopSwitchSchema);
    const supabase = await createServerClient();
    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      is_active: input.isActive,
      updated_at: now,
    };
    if (input.isActive) {
      update.activated_at = now;
      update.activated_by = admin.user.id;
      update.activation_reason = input.reason ?? null;
    } else {
      update.deactivated_at = now;
      update.deactivated_by = admin.user.id;
      update.deactivation_reason = input.reason ?? null;
    }
    const { data, error } = await supabase
      .from("launch_stop_switches")
      .update(update)
      .eq("switch_key", key)
      .select()
      .single();
    await logAdminAudit({
      adminUserId: admin.user.id,
      actionKey: input.isActive
        ? "stop_switch_activated"
        : "stop_switch_deactivated",
      targetType: "launch_stop_switch",
      targetId: data?.id,
      result: error ? "failed" : "success",
      reason: input.reason,
      metadata: { isActive: input.isActive },
    });
    if (error || !data) throw error;
    return apiSuccess({ stopSwitch: data });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId: adminUserId,
      route: "/api/admin/launch/stop-switches",
      method: "PATCH",
    });
  }
}
