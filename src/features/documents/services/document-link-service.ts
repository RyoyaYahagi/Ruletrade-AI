import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";

export async function linkDocumentToTarget(params: {
  userId: string;
  documentId: string;
  targetType:
    | "rule_session"
    | "watchlist_item"
    | "portfolio_position"
    | "portfolio"
    | "manual";
  targetId?: string;
  linkReason?: string;
}) {
  const db = await createDatabaseClient();

  const { data: document } = await db
    .from("user_documents")
    .select("id")
    .eq("id", params.documentId)
    .eq("user_id", params.userId)
    .single();

  if (!document) {
    throw new AppError("NOT_FOUND", "資料が見つかりません。", 404);
  }

  const { data, error } = await db
    .from("document_rag_links")
    .upsert(
      {
        user_id: params.userId,
        document_id: params.documentId,
        target_type: params.targetType,
        target_id: params.targetId ?? null,
        link_reason: params.linkReason ?? null,
      },
      {
        onConflict: "user_id,document_id,target_type,target_id",
      },
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError(
      "INTERNAL_ERROR",
      "資料の紐づけに失敗しました。",
      500,
      error,
    );
  }

  return {
    link: data,
  };
}

export async function listLinkedDocuments(params: {
  userId: string;
  targetType: string;
  targetId?: string;
}) {
  const db = await createDatabaseClient();

  let query = db
    .from("document_rag_links")
    .select(
      `
      *,
      user_documents (*)
      `,
    )
    .eq("user_id", params.userId)
    .eq("target_type", params.targetType);

  if (params.targetId) {
    query = query.eq("target_id", params.targetId);
  }

  const { data, error } = await query.order("created_at", {
    ascending: false,
  });

  if (error) {
    throw error;
  }

  return {
    linkedDocuments: data ?? [],
  };
}
