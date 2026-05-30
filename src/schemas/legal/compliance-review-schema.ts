import { z } from "zod";

export const ComplianceReviewTypeSchema = z.enum([
  "ai_output",
  "user_input",
  "document_summary",
  "watchlist_review",
  "portfolio_review",
  "rule_review",
]);

export const ComplianceReviewSchema = z.object({
  reviewType: ComplianceReviewTypeSchema,
  originalText: z.string().max(10000),
});

export type ComplianceReview = z.infer<typeof ComplianceReviewSchema>;
