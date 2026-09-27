import { z } from "zod";

export const DecisionComparisonSchema = z.object({
  summary: z.string().trim().min(1),
  differences: z.array(z.string().trim().min(1)),
});

export const ReviewSchema = z.object({
  id: z.string().min(1),
  stockId: z.string().min(1),
  decisionId: z.string().min(1).nullable(),
  currentInput: z.string().min(1),
  summary: z.string().min(1),
  differences: z.array(z.string()),
  reflection: z.string().trim().min(1),
  createdAt: z.string().datetime(),
});

export type DecisionComparison = z.infer<typeof DecisionComparisonSchema>;
export type Review = z.infer<typeof ReviewSchema>;
