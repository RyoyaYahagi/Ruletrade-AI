import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { logPrivacyAudit } from "@/features/privacy/services/privacy-audit-service";

export async function createDataDeletionRequest(params: {
  userId: string;
  deletionType: string;
  targetType?: string;
  targetId?: string;
  reason?: string;
}) {
  const db = await createDatabaseClient();

  const { data, error } = await db
    .from("data_deletion_requests")
    .insert({
      user_id: params.userId,
      requested_by_user_id: params.userId,
      deletion_type: params.deletionType,
      target_type: params.targetType ?? null,
      target_id: params.targetId ?? null,
      reason: params.reason ?? null,
      status: "pending",
    })
    .select("*")
    .single();

  if (error || !data) {
    throw error;
  }

  await logPrivacyAudit({
    userId: params.userId,
    actorUserId: params.userId,
    action: "data_deletion_requested",
    targetType: params.deletionType,
    metadata: {
      deletionRequestId: data.id,
      targetType: params.targetType,
      targetId: params.targetId,
    },
  });

  return { deletionRequest: data };
}
