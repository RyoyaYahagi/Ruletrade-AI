import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";

export async function logAdminAudit(params: {
  adminUserId: string;
  actionKey: string;
  targetType: string;
  targetId?: string;
  result?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = await createServerClient();
  await supabase.from("admin_audit_logs").insert({
    admin_user_id: params.adminUserId,
    action: params.actionKey,
    target_type: params.targetType,
    target_id: params.targetId ?? null,
    result: params.result ?? "success",
    reason: params.reason ?? null,
    metadata: params.metadata ?? {},
  });
}
