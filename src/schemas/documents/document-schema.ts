import { z } from "zod";

export const DocumentTypeSchema = z.enum([
  "earnings_material",
  "annual_report",
  "ir_material",
  "research_note",
  "news_note",
  "manual_note",
  "other",
]);

export const DocumentExtractionStatusSchema = z.enum([
  "pending",
  "processing",
  "extracted",
  "failed",
  "skipped",
]);

export const DocumentRagStatusSchema = z.enum([
  "pending",
  "indexed",
  "failed",
  "stale",
  "disabled",
]);

export const UserDocumentSchema = z.object({
  title: z.string().min(1).max(300),
  originalFilename: z.string().min(1).max(300),
  mimeType: z.enum(["application/pdf", "text/plain", "text/markdown"]),
  fileSizeBytes: z
    .number()
    .int()
    .min(0)
    .max(10 * 1024 * 1024),
  documentType: DocumentTypeSchema.default("other"),
  ticker: z.string().max(32).optional(),
  companyName: z.string().max(200).optional(),
  sourceUrl: z.string().url().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type UserDocument = z.infer<typeof UserDocumentSchema>;
