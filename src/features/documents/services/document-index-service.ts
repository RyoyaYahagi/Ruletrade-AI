import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";
import { AppError } from "@/lib/errors/app-error";
import { upsertRagDocument } from "@/features/rag/services/upsert-rag-document";

export async function indexDocumentForRag(params: {
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

  if (!document.extracted_text) {
    throw new AppError("VALIDATION_ERROR", "本文抽出が完了していません。", 400);
  }

  await upsertRagDocument({
    userId: params.userId,
    sourceType: "manual_note",
    sourceId: document.id,
    title: document.title,
    content: buildDocumentRagContent(document),
    metadata: {
      documentId: document.id,
      documentType: document.document_type,
      ticker: document.ticker,
      companyName: document.company_name,
      originalFilename: document.original_filename,
    },
  });

  await supabase
    .from("user_documents")
    .update({
      rag_status: "indexed",
      indexed_at: new Date().toISOString(),
    })
    .eq("id", params.documentId)
    .eq("user_id", params.userId);

  return {
    documentId: params.documentId,
    ragStatus: "indexed",
  };
}

function buildDocumentRagContent(document: {
  title: string;
  document_type: string;
  ticker?: string | null;
  company_name?: string | null;
  source_url?: string | null;
  extracted_text?: string | null;
}) {
  return [
    `資料タイトル: ${document.title}`,
    `資料種別: ${document.document_type}`,
    document.ticker ? `銘枤: ${document.ticker}` : null,
    document.company_name ? `企業名: ${document.company_name}` : null,
    document.source_url ? `参照URL: ${document.source_url}` : null,
    "",
    document.extracted_text,
  ]
    .filter(Boolean)
    .join("\n");
}
