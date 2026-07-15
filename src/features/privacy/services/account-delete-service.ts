import "server-only";

import { deleteLocalAuthUser } from "@/lib/auth/local-auth";
import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";
import { deleteUserAppData } from "@/features/privacy/services/app-data-delete-service";
import { logPrivacyAudit } from "@/features/privacy/services/privacy-audit-service";

export async function requestAccountDeletion(params: {
  userId: string;
  confirmText: string;
  reason?: string;
}) {
  if (params.confirmText !== "DELETE") {
    throw new AppError("VALIDATION_ERROR", "確認テキストが一致しません。", 400);
  }

  const db = await createDatabaseClient();

  const { data, error } = await db
    .from("data_deletion_requests")
    .insert({
      user_id: params.userId,
      requested_by_user_id: params.userId,
      deletion_type: "account",
      status: "pending",
      reason: params.reason ?? null,
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
    targetType: "account",
    metadata: { deletionRequestId: data.id },
  });

  return { deletionRequest: data };
}

export async function executeAccountDeletion(params: {
  userId: string;
  deletionRequestId: string;
}) {
  const db = await createDatabaseClient();

  await db
    .from("data_deletion_requests")
    .update({
      status: "processing",
      processing_started_at: new Date().toISOString(),
    })
    .eq("id", params.deletionRequestId)
    .eq("user_id", params.userId);

  try {
    await deleteUserAppData({ userId: params.userId });

    await db.from("app_users").delete().eq("id", params.userId);

    deleteLocalAuthUser(params.userId);

    await db
      .from("data_deletion_requests")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", params.deletionRequestId);

    await logPrivacyAudit({
      userId: null,
      actorUserId: null,
      action: "account_deleted",
      targetType: "auth_user",
      targetId: params.userId,
      metadata: { deletionRequestId: params.deletionRequestId },
    });

    return { deleted: true };
  } catch (error) {
    await db
      .from("data_deletion_requests")
      .update({
        status: "failed",
        error_message:
          error instanceof Error ? error.message : "Unknown deletion error",
      })
      .eq("id", params.deletionRequestId);

    await logPrivacyAudit({
      userId: params.userId,
      actorUserId: params.userId,
      action: "deletion_failed",
      targetType: "account",
      metadata: { deletionRequestId: params.deletionRequestId },
    });

    throw error;
  }
}
