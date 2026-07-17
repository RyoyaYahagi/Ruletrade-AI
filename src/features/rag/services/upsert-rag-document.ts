import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { hashContent } from "@/lib/rag/hash-content";
import { chunkText } from "@/lib/rag/chunk-text";
import { getEmbeddingProvider } from "@/lib/ai/embeddings/embedding-provider-factory";
import { AppError } from "@/lib/errors/app-error";

export async function upsertRagDocument(params: {
  userId: string;
  sourceType:
    | "investor_profile"
    | "rule_session"
    | "rule_version"
    | "rule_review"
    | "watchlist_item"
    | "watchlist_review"
    | "portfolio_position"
    | "portfolio_review"
    | "trade_reflection"
    | "alert_resolution"
    | "news_assessment"
    | "holistic_review"
    | "manual_note"
    | "earnings_report";
  sourceId: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}) {
  const db = await createDatabaseClient();

  const contentHash = hashContent(params.content);

  const { data: existing } = await db
    .from("rag_documents")
    .select("id, content_hash")
    .eq("user_id", params.userId)
    .eq("source_type", params.sourceType)
    .eq("source_id", params.sourceId)
    .maybeSingle();

  if (existing?.content_hash === contentHash) {
    return {
      documentId: existing.id,
      skipped: true,
    };
  }

  const { data: document, error: documentError } = await db
    .from("rag_documents")
    .upsert(
      {
        user_id: params.userId,
        source_type: params.sourceType,
        source_id: params.sourceId,
        title: params.title,
        content: params.content,
        metadata: params.metadata ?? {},
        content_hash: contentHash,
        embedding_status: "pending",
      },
      {
        onConflict: "user_id,source_type,source_id",
      },
    )
    .select("id")
    .single();

  if (documentError || !document) {
    throw new AppError(
      "INTERNAL_ERROR",
      "RAGドキュメントの作成に失敗しました。",
      500,
      documentError,
    );
  }

  await embedRagDocument({
    userId: params.userId,
    documentId: document.id,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    content: params.content,
    metadata: params.metadata ?? {},
  });

  return {
    documentId: document.id,
    skipped: false,
  };
}

async function embedRagDocument(params: {
  userId: string;
  documentId: string;
  sourceType: string;
  sourceId: string;
  content: string;
  metadata: Record<string, unknown>;
}) {
  const db = await createDatabaseClient();
  const embeddingProvider = getEmbeddingProvider();

  const chunks = chunkText({
    text: params.content,
    maxChars: 1200,
    overlapChars: 150,
  });

  const embeddingResult = await embeddingProvider.createEmbeddings({
    input: chunks,
    taskType: "retrieval_document",
  });

  await db
    .from("rag_chunks")
    .delete()
    .eq("user_id", params.userId)
    .eq("document_id", params.documentId);

  const rows = chunks.map((chunk, index) => ({
    user_id: params.userId,
    document_id: params.documentId,
    source_type: params.sourceType,
    source_id: params.sourceId,
    chunk_index: index,
    content: chunk,
    content_hash: hashContent(chunk),
    embedding_provider: embeddingResult.provider,
    embedding_model: embeddingResult.model,
    embedding: embeddingResult.embeddings[index] ?? null,
    token_count: null,
    metadata: params.metadata,
  }));

  const { error: chunksError } = await db.from("rag_chunks").insert(rows);

  if (chunksError) {
    await db
      .from("rag_documents")
      .update({
        embedding_status: "failed",
      })
      .eq("id", params.documentId)
      .eq("user_id", params.userId);

    throw new AppError(
      "INTERNAL_ERROR",
      "RAG chunkの保存に失敗しました。",
      500,
      chunksError,
    );
  }

  await db
    .from("rag_documents")
    .update({
      embedding_status: "embedded",
      last_embedded_at: new Date().toISOString(),
    })
    .eq("id", params.documentId)
    .eq("user_id", params.userId);
}
