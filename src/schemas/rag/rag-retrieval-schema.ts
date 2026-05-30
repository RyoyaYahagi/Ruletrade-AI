import { z } from "zod";
import { RagSourceTypeSchema } from "@/schemas/rag/rag-document-schema";

export const RagRetrievedChunkSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  sourceType: RagSourceTypeSchema,
  sourceId: z.string().uuid(),
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  similarity: z.number(),
});

export const RagRetrievalResultSchema = z.object({
  chunks: z.array(RagRetrievedChunkSchema),
  contextText: z.string(),
});

export type RagRetrievedChunk = z.infer<typeof RagRetrievedChunkSchema>;
export type RagRetrievalResult = z.infer<typeof RagRetrievalResultSchema>;
