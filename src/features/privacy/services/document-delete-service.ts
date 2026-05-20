import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";
import { AppError } from "@/lib/errors/app-error";
import { logPrivacyAudit } from "@/features/privacy/services/privacy-audit-service";

export async function deleteUserDocument(params: {
  userId: string;
  documentId: string;
}) {
  const supabase = await createServerClient();

  const { data: document, error } = await supabase
    .from("user_documents")
    .select("*")
    .eq("id", params.documentId)
    .eq("user_id", params.userId)
    .single();

  if (error || !document) {
    throw new AppError("NOT_FOUND", "資料が見つかりません。", 404);
  }

  const { error: storageError } = await supabase.storage
    .from(document.storage_bucket)
    .remove([document.storage_path]);

  if (storageError) {
    throw new AppError(
      "PROCESSING_FAILED",
      "Storage objectの削除に失敗しました。",
      500,
      storageError,
    );
  }

  await supabase
    .from("rag_documents")
    .delete()
    .eq("user_id", params.userId)
    .eq("source_type", "manual_note")
    .eq("source_id", params.documentId);

  const { error: deleteError } = await supabase
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
