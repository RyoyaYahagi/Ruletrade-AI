import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { getEmbeddingProvider } from "@/lib/ai/embeddings/embedding-provider-factory";
import type { AITaskType } from "@/lib/ai/provider";

type RagChunkRow = {
  id: string;
  source_type: string;
  source_id: string;
  content: string;
  embedding: unknown;
};

type RetrievedChunk = {
  id: string;
  source_type: string;
  source_id: string;
  content: string;
  similarity: number;
};

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

  const db = await createDatabaseClient();
  let query = db
    .from("rag_chunks")
    .select("id, source_type, source_id, content, embedding")
    .eq("user_id", params.userId);

  if (params.sourceTypes && params.sourceTypes.length > 0) {
    query = query.in("source_type", params.sourceTypes);
  }

  const { data, error } = await query;
  if (error) throw error;

  const queryEmbedding = embeddingResult.embeddings[0] ?? [];
  const chunks = (data ?? [])
    .map((row: RagChunkRow) => {
      const embedding = parseEmbedding(row.embedding);
      return {
        id: row.id,
        source_type: row.source_type,
        source_id: row.source_id,
        content: row.content,
        similarity: cosineSimilarity(queryEmbedding, embedding),
      };
    })
    .filter((chunk: RetrievedChunk) => chunk.similarity >= matchThreshold)
    .sort(
      (left: RetrievedChunk, right: RetrievedChunk) =>
        right.similarity - left.similarity,
    )
    .slice(0, matchCount);

  const contextText = buildContextText({
    chunks,
    maxContextChars,
  });

  await db.from("rag_retrieval_logs").insert({
    user_id: params.userId,
    request_id: params.requestId ?? null,
    task_type: params.taskType,
    query_text: params.queryText,
    query_embedding_model: embeddingResult.model,
    query_embedding_provider: embeddingResult.provider,
    match_threshold: matchThreshold,
    match_count: matchCount,
    retrieved_chunk_ids: chunks.map((chunk: RetrievedChunk) => chunk.id),
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

function parseEmbedding(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is number => typeof item === "number");
  }

  if (typeof value !== "string") return [];

  try {
    return parseEmbedding(JSON.parse(value));
  } catch {
    return [];
  }
}

function cosineSimilarity(left: number[], right: number[]) {
  if (left.length === 0 || left.length !== right.length) return 0;

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue ** 2;
    rightMagnitude += rightValue ** 2;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
  return dot / Math.sqrt(leftMagnitude * rightMagnitude);
}

function buildContextText(params: {
  chunks: Array<Pick<RetrievedChunk, "source_type" | "source_id" | "content" | "similarity">>;
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
