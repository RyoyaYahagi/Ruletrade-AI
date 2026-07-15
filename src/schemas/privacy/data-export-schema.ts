import { z } from "zod";

export const DataExportRequestSchema = z.object({
  exportFormat: z.enum(["json", "csv"]).default("json"),

  includeAiLogs: z.boolean().default(true),
  includeDocumentsMetadata: z.boolean().default(true),
  includeExtractedText: z.boolean().default(false),
  includeRagChunks: z.boolean().default(false),
});

export type DataExportRequest = z.infer<typeof DataExportRequestSchema>;
