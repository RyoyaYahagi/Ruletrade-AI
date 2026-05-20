import { requireAdminPermission } from "@/features/admin/services/admin-auth-service";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { UpdateBetaFeatureFlagSchema } from "@/schemas/launch/beta-schema";
import { createServerClient } from "@/lib/db/supabase-server";
import { logAdminAudit } from "@/features/admin/services/admin-audit-service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ flagKey?: string[] }> },
) {
  const requestId = crypto.randomUUID();
  let adminUserId: string | null = null;
  try {
    const admin = await requireAdminPermission("admin.beta.update");
    adminUserId = admin.user.id;
    const { flagKey } = await params;
    const key = flagKey?.[0];
    if (!key) {
      return toErrorResponse(new Error("flagKey is required."), {
        requestId,
        userId: adminUserId,
        route: "/api/admin/beta/feature-flags",
        method: "PATCH",
      });
    }
    const input = await validateJsonRequest(
      request,
      UpdateBetaFeatureFlagSchema,
    );
    const supabase = await createServerClient();
    const update: Record<string, unknown> = {};
    if (input.isEnabledGlobally !== undefined)
      update.is_enabled_globally = input.isEnabledGlobally;
    if (input.enabledCohortKeys !== undefined)
      update.enabled_cohort_keys = input.enabledCohortKeys;
    if (input.killSwitchEnabled !== undefined)
      update.kill_switch_enabled = input.killSwitchEnabled;
    const { data, error } = await supabase
      .from("beta_feature_flags")
      .update(update)
      .eq("flag_key", key)
      .select()
      .single();
    await logAdminAudit({
      adminUserId: admin.user.id,
      actionKey: "beta_feature_flag_updated",
      targetType: "beta_feature_flag",
      targetId: data?.id,
      result: error ? "failed" : "success",
      reason: error?.message,
      metadata: update,
    });
    if (error || !data) throw error;
    return apiSuccess({ flag: data });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId: adminUserId,
      route: "/api/admin/beta/feature-flags",
      method: "PATCH",
    });
  }
}
