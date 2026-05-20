import { z } from "zod";
import { RagSourceTypeSchema } from "@/schemas/rag/rag-document-schema";

export const RagChunkSchema = z.object({
  documentId: z.string().uuid(),
  sourceType: RagSourceTypeSchema,
  sourceId: z.string().uuid(),
  chunkIndex: z.number().int().min(0),
  content: z.string().min(1).max(8000),
  embeddingProvider: z.string(),
  embeddingModel: z.string(),
  tokenCount: z.number().int().min(0).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type RagChunk = z.infer<typeof RagChunkSchema>;
