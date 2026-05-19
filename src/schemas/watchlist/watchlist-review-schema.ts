import { z } from "zod";
import { SafetyCheckSchema } from "@/schemas/safety/safety-check-schema";

export const WatchlistQualityCheckSchema = z.object({
  checkKey: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  status: z.enum(["pass", "warning", "fail"]),
  severity: z.enum(["low", "medium", "high"]),
  reason: z.string().min(1).max(2000),
  relatedTickers: z.array(z.string()).default([]),
  suggestedQuestion: z.string().max(1000).optional(),
});

export const WatchlistReviewSchema = z.object({
  summary: z.string().min(1).max(4000),
  readinessScore: z.number().int().min(0).max(100),
  needsMoreInfo: z.boolean(),
  canCreateRuleSession: z.boolean(),
  qualityChecks: z.array(WatchlistQualityCheckSchema).default([]),
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
  safety: SafetyCheckSchema,
});

export type WatchlistReview = z.infer<typeof WatchlistReviewSchema>;
