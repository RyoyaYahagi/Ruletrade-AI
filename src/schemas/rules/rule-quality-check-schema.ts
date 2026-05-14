import { z } from "zod";

export const QualityCheckStatusSchema = z.enum(["pass", "warning", "fail"]);

export const QualityCheckSeveritySchema = z.enum(["low", "medium", "high"]);

export const RuleQualityCheckSchema = z.object({
  checkKey: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  status: QualityCheckStatusSchema,
  severity: QualityCheckSeveritySchema,
  reason: z.string().min(1).max(2000),
  suggestedQuestion: z.string().max(1000).optional(),
});

export type RuleQualityCheck = z.infer<typeof RuleQualityCheckSchema>;

