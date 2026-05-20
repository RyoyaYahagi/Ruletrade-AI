import { requireAdminPermission } from "@/features/admin/services/admin-auth-service";
import { validateJsonRequest } from "@/lib/api/validate-request";
import { apiCreated } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { CreateBetaInviteCodeRequestSchema } from "@/schemas/launch/beta-schema";
import {
  generateInviteCode,
  hashInviteCode,
} from "@/features/launch/services/beta-invite-code-service";
import { createServerClient } from "@/lib/db/supabase-server";
import { logAdminAudit } from "@/features/admin/services/admin-audit-service";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let adminUserId: string | null = null;
  try {
    const admin = await requireAdminPermission("admin.beta.invite");
    adminUserId = admin.user.id;
    const input = await validateJsonRequest(
      request,
      CreateBetaInviteCodeRequestSchema,
    );
    const rawCode = generateInviteCode();
    const codeHash = hashInviteCode(rawCode);
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("beta_invite_codes")
      .insert({
        code_hash: codeHash,
        cohort_id: input.cohortId,
        max_uses: input.maxUses,
        expires_at: input.expiresAt ?? null,
        created_by: admin.user.id,
      })
      .select("id, cohort_id, max_uses, expires_at, created_at")
      .single();
    await logAdminAudit({
      adminUserId: admin.user.id,
      actionKey: "beta_invite_code_created",
      targetType: "beta_invite_code",
      targetId: data?.id,
      result: error ? "failed" : "success",
      reason: error?.message,
      metadata: { maxUses: input.maxUses, expiresAt: input.expiresAt },
    });
    if (error || !data) throw error;
    return apiCreated({
      inviteCode: rawCode,
      inviteCodeRecord: data,
      warning: "This raw invite code is shown only once. Store it securely.",
    });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      userId: adminUserId,
      route: "/api/admin/beta/invite-codes",
      method: "POST",
    });
  }
}
