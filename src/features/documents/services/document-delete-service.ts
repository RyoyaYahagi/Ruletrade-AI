import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";
import { removeLocalStorageFiles } from "@/lib/storage/local-file-storage";

export async function deleteDocument(params: {
  userId: string;
  documentId: string;
}) {
  const db = await createDatabaseClient();

  const { data: document, error: findError } = await db
    .from("user_documents")
    .select("storage_path")
    .eq("id", params.documentId)
    .eq("user_id", params.userId)
    .single();

  if (findError || !document) {
    throw new AppError("NOT_FOUND", "資料が見つかりません。", 404);
  }

  if (document.storage_path) {
    await removeLocalStorageFiles({
      bucket: "documents",
      storagePaths: [document.storage_path],
    });
  }

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
    throw new AppError(
      "INTERNAL_ERROR",
      "資料の削除に失敗しました。",
      500,
      deleteError,
    );
  }

  return {
    documentId: params.documentId,
    deleted: true,
  };
}
