import { z } from "zod";

export const PortfolioQualityCheckSchema = z.object({
  checkKey: z.string().min(1).max(100),

  label: z.string().min(1).max(200),

  status: z.enum(["pass", "warning", "fail"]),

  severity: z.enum(["low", "medium", "high"]),

  reason: z.string().min(1).max(2000),

  relatedTickers: z.array(z.string()).default([]),

  suggestedQuestion: z.string().max(1000).optional(),
});

export const PortfolioReviewSchema = z.object({
  summary: z.string().min(1).max(4000),

  riskScore: z.number().int().min(0).max(100),

  diversificationScore: z.number().int().min(0).max(100),

  ruleCoverageScore: z.number().int().min(0).max(100),

  needsMoreInfo: z.boolean(),

  qualityChecks: z.array(PortfolioQualityCheckSchema).default([]),

  followUpQuestions: z
    .array(
      z.object({
        questionKey: z.string(),
        questionText: z.string(),
        relatedTickers: z.array(z.string()).default([]),
      }),
    )
    .default([]),

  suggestedRuleSessionTargets: z
    .array(
      z.object({
        ticker: z.string(),
        reason: z.string(),
      }),
    )
    .default([]),
});

export type PortfolioReview = z.infer<typeof PortfolioReviewSchema>;
export type PortfolioQualityCheck = z.infer<typeof PortfolioQualityCheckSchema>;
