import { z } from "zod";

export const NewsClassificationSchema = z.object({
  relevance: z.enum(["affects_thesis", "not_relevant"]),
  thesisRelation: z.enum(["supports", "challenges", "unclear"]).optional(),
  matchedBreakerIndex: z.number().int().min(0).max(9).nullable(),
  reason: z.string().max(200),
});

export const NewsSummarySchema = z.object({
  summary: z.string().min(1).max(1000),
});

export type NewsClassification = z.infer<typeof NewsClassificationSchema>;
