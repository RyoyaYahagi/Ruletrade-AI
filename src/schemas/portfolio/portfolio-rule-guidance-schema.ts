import { z } from "zod";
import {
  RiskToleranceSchema,
  TargetAllocationSchema,
} from "@/schemas/portfolio/portfolio-rule-schema";

export const PortfolioRuleGuidanceDraftSchema = z.object({
  riskTolerance: RiskToleranceSchema.optional(),
  maxPositionCount: z.number().int().min(1).max(500).optional(),
  maxPositionPercent: z.number().min(0).max(100).optional(),
  maxSectorPercent: z.number().min(0).max(100).optional(),
  maxThemePercent: z.number().min(0).max(100).optional(),
  maxMarketPercent: z.number().min(0).max(100).optional(),
  minCashPercent: z.number().min(0).max(100).optional(),
  maxSingleTradeLossPercent: z.number().min(0).max(100).optional(),
  excludedAssetTypes: z.array(z.string().min(1).max(50)).max(20).optional(),
  targetAllocations: z.array(TargetAllocationSchema).max(20).optional(),
  notes: z.string().max(4000).optional(),
});

export const PortfolioRuleGuidanceAnswerSchema = z.object({
  key: z.string().min(1).max(80),
  question: z.string().min(1).max(240),
  answer: z.string().min(1).max(2000),
  value: z.string().min(1).max(400),
});

export const PortfolioRuleGuidanceRequestSchema = z.object({
  answers: z.array(PortfolioRuleGuidanceAnswerSchema).max(20).default([]),
  draft: PortfolioRuleGuidanceDraftSchema.default({}),
});

export const PortfolioRuleGuidanceQuestionSchema = z.object({
  key: z.string().min(1).max(80),
  text: z.string().min(1).max(240),
  explanation: z.string().min(1).max(160),
});

export const PortfolioRuleGuidanceSuggestionSchema = z.object({
  key: z.string().min(1).max(40),
  title: z.string().min(1).max(40),
  summary: z.string().min(1).max(180),
  tradeoff: z.string().min(1).max(180),
  draft: PortfolioRuleGuidanceDraftSchema,
});

export const PortfolioRuleGuidanceResponseSchema = z.object({
  message: z.string().min(1).max(500),
  question: PortfolioRuleGuidanceQuestionSchema.nullable(),
  suggestions: z.array(PortfolioRuleGuidanceSuggestionSchema).max(3).default([]),
  consistencyNotes: z.array(z.string().min(1).max(200)).max(5).default([]),
  progress: z.number().int().min(0).max(100),
  readyToReview: z.boolean(),
  guidance: z.array(z.string().min(1).max(180)).max(3).default([]),
  disclaimer: z.string().min(1).max(200),
});

export type PortfolioRuleGuidanceDraft = z.infer<
  typeof PortfolioRuleGuidanceDraftSchema
>;
export type PortfolioRuleGuidanceAnswer = z.infer<
  typeof PortfolioRuleGuidanceAnswerSchema
>;
export type PortfolioRuleGuidanceRequest = z.infer<
  typeof PortfolioRuleGuidanceRequestSchema
>;
export type PortfolioRuleGuidanceResponse = z.infer<
  typeof PortfolioRuleGuidanceResponseSchema
>;
export type PortfolioRuleGuidanceSuggestion = z.infer<
  typeof PortfolioRuleGuidanceSuggestionSchema
>;
