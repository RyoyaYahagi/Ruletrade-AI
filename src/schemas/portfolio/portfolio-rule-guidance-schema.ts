import { z } from "zod";
import { TargetAllocationSchema } from "@/schemas/portfolio/portfolio-rule-schema";

export const PortfolioRuleGuidanceDraftSchema = z.object({
  maxPositionPercent: z.number().min(0).max(100).optional(),
  maxSectorPercent: z.number().min(0).max(100).optional(),
  maxThemePercent: z.number().min(0).max(100).optional(),
  minCashPercent: z.number().min(0).max(100).optional(),
  maxSingleTradeLossPercent: z.number().min(0).max(100).optional(),
  targetAllocations: z.array(TargetAllocationSchema).max(20).optional(),
  notes: z.string().max(4000).optional(),
});

export const PortfolioRuleGuidanceMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

export const PortfolioRuleGuidanceRequestSchema = z.object({
  history: z.array(PortfolioRuleGuidanceMessageSchema).max(12).default([]),
  draft: PortfolioRuleGuidanceDraftSchema.default({}),
});

export const PortfolioRuleGuidanceQuestionSchema = z.object({
  key: z.string().min(1).max(80),
  text: z.string().min(1).max(800),
  explanation: z.string().max(1200).optional(),
});

export const PortfolioRuleGuidanceResponseSchema = z.object({
  message: z.string().min(1).max(2000),
  question: PortfolioRuleGuidanceQuestionSchema.nullable(),
  suggestion: PortfolioRuleGuidanceDraftSchema.default({}),
  progress: z.number().int().min(0).max(100),
  readyToReview: z.boolean(),
  guidance: z.array(z.string().min(1).max(500)).max(5).default([]),
  disclaimer: z.string().min(1).max(600),
});

export type PortfolioRuleGuidanceDraft = z.infer<
  typeof PortfolioRuleGuidanceDraftSchema
>;
export type PortfolioRuleGuidanceMessage = z.infer<
  typeof PortfolioRuleGuidanceMessageSchema
>;
export type PortfolioRuleGuidanceRequest = z.infer<
  typeof PortfolioRuleGuidanceRequestSchema
>;
export type PortfolioRuleGuidanceResponse = z.infer<
  typeof PortfolioRuleGuidanceResponseSchema
>;
