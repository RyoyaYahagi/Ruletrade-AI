import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";

export async function logPrivacyAudit(params: {
  userId: string | null;
  actorUserId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}) {
  const db = await createDatabaseClient();

  await db.from("privacy_audit_logs").insert({
    user_id: params.userId,
    actor_user_id: params.actorUserId,
    action: params.action,
    target_type: params.targetType ?? null,
    target_id: params.targetId ?? null,
    metadata: params.metadata ?? {},
  });
}
