import { requireAdminPermission } from "@/features/admin/services/admin-auth-service";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { apiCreated, apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import {
  createReleasePlan,
  listReleasePlans,
} from "@/features/release/services/release-plan-service";
import { CreateReleasePlanRequestSchema } from "@/schemas/release/release-schema";
import { logAdminAudit } from "@/features/admin/services/admin-audit-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    await requireAdminPermission("admin.releases.read");
    const { data: releases } = await listReleasePlans({});
    return apiSuccess({ releases });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/admin/releases",
      method: "GET",
    });
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let adminUserId: string | null = null;
  try {
    const admin = await requireAdminPermission("admin.releases.update");
    adminUserId = admin.user.id;
    const input = await validateJsonRequest(
      request,
      CreateReleasePlanRequestSchema,
    );
    const result = await createReleasePlan({
      release_key: input.releaseKey,
      version: input.version,
      title: input.title,
      summary: input.summary,
      phase: input.phase,
      release_type: input.releaseType,
      milestone_key: input.milestoneKey,
      planned_release_at: input.plannedReleaseAt,
      includes_db_migration: input.includesDbMigration,
      includes_rls_change: input.includesRlsChange,
      includes_env_change: input.includesEnvChange,
      includes_feature_flag_change: input.includesFeatureFlagChange,
      includes_ai_prompt_change: input.includesAiPromptChange,
      includes_billing_change: input.includesBillingChange,
      includes_privacy_change: input.includesPrivacyChange,
      rollback_strategy: input.rollbackStrategy,
      created_by: admin.user.id,
    });
    await logAdminAudit({
      adminUserId: admin.user.id,
      actionKey: "release_plan_created",
      targetType: "release_plan",
      targetId: result.data.id,
      result: "success",
      metadata: {
        releaseKey: input.releaseKey,
        version: input.version,
        title: input.title,
      },
    });
    return apiCreated({ release: result.data });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId: adminUserId,
      route: "/api/admin/releases",
      method: "POST",
    });
  }
}
