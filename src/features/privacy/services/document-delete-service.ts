import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";
import { logPrivacyAudit } from "@/features/privacy/services/privacy-audit-service";
import { removeLocalStorageFiles } from "@/lib/storage/local-file-storage";

export async function deleteUserDocument(params: {
  userId: string;
  documentId: string;
}) {
  const db = await createDatabaseClient();

  const { data: document, error } = await db
    .from("user_documents")
    .select("*")
    .eq("id", params.documentId)
    .eq("user_id", params.userId)
    .single();

  if (error || !document) {
    throw new AppError("NOT_FOUND", "資料が見つかりません。", 404);
  }

  await removeLocalStorageFiles({
    bucket: document.storage_bucket ?? "documents",
    storagePaths: [document.storage_path],
  });

  await db
    .from("rag_chunks")
    .delete()
    .eq("user_id", params.userId)
    .in("source_type", ["manual_note", "earnings_report"])
    .eq("source_id", params.documentId);

  await db
    .from("rag_documents")
    .delete()
    .eq("user_id", params.userId)
    .in("source_type", ["manual_note", "earnings_report"])
    .eq("source_id", params.documentId);

  const { error: deleteError } = await db
    .from("user_documents")
    .delete()
    .eq("id", params.documentId)
    .eq("user_id", params.userId);

  if (deleteError) {
    throw deleteError;
  }

  await logPrivacyAudit({
    userId: params.userId,
    actorUserId: params.userId,
    action: "document_deleted",
    targetType: "document",
    targetId: params.documentId,
    metadata: { storagePath: document.storage_path, title: document.title },
  });

  return { deleted: true, documentId: params.documentId };
}
