import { z } from "zod";

export const DocumentSummarySchema = z.object({
  summary: z.string().max(5000),
  keyPoints: z.array(z.string().max(1000)).max(20),
  risks: z.array(z.string().max(1000)).max(20),
  opportunities: z.array(z.string().max(1000)).max(20),
  assumptions: z.array(z.string().max(1000)).max(20),
  questionsForRuleDesign: z.array(z.string().max(1000)).max(20),
});

export type DocumentSummary = z.infer<typeof DocumentSummarySchema>;
