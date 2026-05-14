import { z } from "zod";
import {
  CompanyNameSchema,
  TickerSchema,
  UuidSchema,
} from "@/schemas/common/primitive-schema";
import { RuleAnswerSchema } from "@/schemas/rules/rule-answer-schema";

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
});

export const RunRuleReviewRequestSchema = z.object({
  sessionId: UuidSchema.optional(),
  force: z.boolean().default(false),
});

export const RunRuleReviewResponseSchema = z.object({
  reviewId: UuidSchema,
  completionScore: z.number().int().min(0).max(100),
  needsMoreInfo: z.boolean(),
  canFinalize: z.boolean(),
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
export type RunRuleReviewRequest = z.infer<
  typeof RunRuleReviewRequestSchema
>;
export type RunRuleReviewResponse = z.infer<
  typeof RunRuleReviewResponseSchema
>;

