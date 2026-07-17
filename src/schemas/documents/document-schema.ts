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

export const DocumentKindSchema = z.enum(["note", "earnings_report"]);
export const FiscalPeriodSchema = z.string().regex(/^FY\d{4}(Q[1-4])?$/);

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
  documentKind: DocumentKindSchema.default("note"),
  fiscalPeriod: FiscalPeriodSchema.optional(),
  ticker: z.string().max(32).optional(),
  companyName: z.string().max(200).optional(),
  sourceUrl: z.string().url().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
}).superRefine((value, context) => {
  if (value.documentKind !== "earnings_report") return;
  if (!value.ticker) {
    context.addIssue({ code: "custom", path: ["ticker"], message: "決算資料には銘柄コードが必要です。" });
  }
  if (!value.fiscalPeriod) {
    context.addIssue({ code: "custom", path: ["fiscalPeriod"], message: "決算資料には会計期間が必要です。" });
  }
});

export type UserDocument = z.infer<typeof UserDocumentSchema>;
