import { z } from "zod";

export const DataDeletionTypeSchema = z.enum([
  "rag_memory",
  "document",
  "app_data",
  "account",
]);

export const DataDeletionRequestSchema = z.object({
  deletionType: DataDeletionTypeSchema,

  targetType: z.string().optional(),
  targetId: z.string().uuid().optional(),

  reason: z.string().max(1000).optional(),

  confirmText: z.string().optional(),
});

export type DataDeletionRequest = z.infer<typeof DataDeletionRequestSchema>;
