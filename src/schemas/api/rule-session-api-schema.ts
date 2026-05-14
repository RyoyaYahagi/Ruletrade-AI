import { z } from "zod";
import {
  CompanyNameSchema,
  TickerSchema,
  UuidSchema,
} from "@/schemas/common/primitive-schema";
import { RuleAnswerSchema } from "@/schemas/rules/rule-answer-schema";
import { TradeRuleSchema } from "@/schemas/rules/trade-rule-schema";

export const CreateRuleSessionRequestSchema = z.object({
  ticker: TickerSchema,
  companyName: CompanyNameSchema.optional(),
  market: z.string().max(50).optional(),
  currency: z.string().max(10).default("JPY"),
  templateKey: z.string().max(100).optional(),
});

export const CreateRuleSessionResponseSchema = z.object({
  sessionId: UuidSchema,
});

export const SaveRuleAnswerRequestSchema = RuleAnswerSchema.extend({
  questionId: UuidSchema.optional(),
});

export const SaveRuleAnswerResponseSchema = z.object({
  answerId: UuidSchema,
  sessionId: UuidSchema,
  ruleJson: z.unknown(),
});

export const RunRuleReviewResponseSchema = z.object({
  reviewId: UuidSchema,
  completionScore: z.number().int().min(0).max(100),
  needsMoreInfo: z.boolean(),
  canFinalize: z.boolean(),
  nextQuestions: z.array(z.unknown()).default([]),
});

export const UpdateRuleSessionRequestSchema = z.object({
  status: z.enum(["draft", "in_progress", "needs_more_info", "quality_gate_passed", "paused", "finalized", "archived"]).optional(),
  ruleJson: TradeRuleSchema.optional(),
});

export const FinalizeRuleSessionRequestSchema = z.object({
  force: z.boolean().default(false),
});

export type CreateRuleSessionRequest = z.infer<
  typeof CreateRuleSessionRequestSchema
>;
export type CreateRuleSessionResponse = z.infer<
  typeof CreateRuleSessionResponseSchema
>;
export type SaveRuleAnswerRequest = z.infer<
  typeof SaveRuleAnswerRequestSchema
>;
export type SaveRuleAnswerResponse = z.infer<
  typeof SaveRuleAnswerResponseSchema
>;
export type RunRuleReviewResponse = z.infer<
  typeof RunRuleReviewResponseSchema
>;
export type UpdateRuleSessionRequest = z.infer<
  typeof UpdateRuleSessionRequestSchema
>;
export type FinalizeRuleSessionRequest = z.infer<
  typeof FinalizeRuleSessionRequestSchema
>;

