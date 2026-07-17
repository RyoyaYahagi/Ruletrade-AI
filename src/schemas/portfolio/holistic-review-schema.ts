import { z } from "zod";

export const HolisticReviewFindingCategorySchema = z.enum([
  "risk_tolerance_mismatch",
  "missing_rule",
  "missing_exit",
  "concentration",
  "constraint_check",
  "stale_rule",
]);

export const HolisticReviewFindingSchema = z.object({
  category: HolisticReviewFindingCategorySchema,
  status: z.enum(["ok", "attention"]),
  message: z.string().min(1).max(300),
  relatedSymbols: z.array(z.string().min(1)).max(20).default([]),
});

export const HolisticReviewSchema = z.object({
  findings: z.array(HolisticReviewFindingSchema).max(20),
  overallNote: z.string().min(1).max(500),
});

export type HolisticReview = z.infer<typeof HolisticReviewSchema>;
export type HolisticReviewFinding = z.infer<
  typeof HolisticReviewFindingSchema
>;
