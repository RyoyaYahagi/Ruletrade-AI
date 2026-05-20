import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";

export async function logPrivacyAudit(params: {
  userId: string | null;
  actorUserId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = await createServerClient();

  await supabase.from("privacy_audit_logs").insert({
    user_id: params.userId,
    actor_user_id: params.actorUserId,
    action: params.action,
    target_type: params.targetType ?? null,
    target_id: params.targetId ?? null,
    metadata: params.metadata ?? {},
  });
}
