import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";
import { AppError } from "@/lib/errors/app-error";

export async function deleteDocument(params: {
  userId: string;
  documentId: string;
}) {
  const supabase = await createServerClient();

  const { data: document, error: findError } = await supabase
    .from("user_documents")
    .select("storage_path")
    .eq("id", params.documentId)
    .eq("user_id", params.userId)
    .single();

  if (findError || !document) {
    throw new AppError("NOT_FOUND", "資料が見つかりません。", 404);
  }

  // Storageから削除
  if (document.storage_path) {
    await supabase.storage.from("documents").remove([document.storage_path]);
  }

  // DBから削除（cascadeで関連テーブルも消える）
  const { error: deleteError } = await supabase
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
