import "server-only";

import { createServerClient } from "@/lib/db/supabase-server";
import { getEmbeddingProvider } from "@/lib/ai/embeddings/embedding-provider-factory";
import type { AITaskType } from "@/lib/ai/provider";

export async function retrieveRagContext(params: {
  userId: string;
  requestId?: string;
  taskType: AITaskType;
  queryText: string;
  sourceTypes?: string[];
  matchThreshold?: number;
  matchCount?: number;
  maxContextChars?: number;
}) {
  const startedAt = Date.now();

  const matchThreshold =
    params.matchThreshold ?? Number(process.env.RAG_MATCH_THRESHOLD ?? 0.75);

  const matchCount =
    params.matchCount ?? Number(process.env.RAG_MATCH_COUNT ?? 8);

  const maxContextChars =
    params.maxContextChars ?? Number(process.env.RAG_MAX_CONTEXT_CHARS ?? 6000);

  const embeddingProvider = getEmbeddingProvider();

  const embeddingResult = await embeddingProvider.createEmbeddings({
    input: params.queryText,
    taskType: "retrieval_query",
  });

  const queryEmbedding = embeddingResult.embeddings[0];

  const supabase = await createServerClient();

  const { data, error } = await supabase.rpc("match_rag_chunks", {
    p_user_id: params.userId,
    p_query_embedding: queryEmbedding,
    p_match_threshold: matchThreshold,
    p_match_count: matchCount,
    p_source_types: params.sourceTypes ?? null,
  });

  if (error) {
    if (isUnsupportedLocalRpc(error)) {
      return {
        chunks: [],
        contextText: "",
      };
    }

    throw error;
  }

  const chunks = (data ?? []) as Array<{
    id: string;
    source_type: string;
    source_id: string;
    content: string;
    similarity: number;
  }>;

  const contextText = buildContextText({
    chunks,
    maxContextChars,
  });

  await supabase.from("rag_retrieval_logs").insert({
    user_id: params.userId,
    request_id: params.requestId ?? null,
    task_type: params.taskType,
    query_text: params.queryText,
    query_embedding_model: embeddingResult.model,
    query_embedding_provider: embeddingResult.provider,
    match_threshold: matchThreshold,
    match_count: matchCount,
    retrieved_chunk_ids: chunks.map((chunk) => chunk.id),
    retrieved_count: chunks.length,
    metadata: {
      sourceTypes: params.sourceTypes ?? null,
    },
    latency_ms: Date.now() - startedAt,
  });

  return {
    chunks,
    contextText,
  };
}

function isUnsupportedLocalRpc(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "SQLITE_UNSUPPORTED"
  );
}

function buildContextText(params: {
  chunks: Array<{
    source_type: string;
    source_id: string;
    content: string;
    similarity: number;
  }>;
  maxContextChars: number;
}) {
  const parts: string[] = [];

  for (const chunk of params.chunks) {
    parts.push(
      [
        `source_type: ${chunk.source_type}`,
        `source_id: ${chunk.source_id}`,
        `similarity: ${Number(chunk.similarity).toFixed(4)}`,
        chunk.content,
      ].join("\n"),
    );
  }

  const text = parts.join("\n\n---\n\n");

  if (text.length <= params.maxContextChars) {
    return text;
  }

  return text.slice(0, params.maxContextChars);
}
