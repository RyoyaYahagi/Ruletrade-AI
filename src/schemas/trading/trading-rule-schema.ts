import { z } from "zod";

export const TradingRuleStatusSchema = z.enum([
  "draft",
  "in_review",
  "blocked",
  "approved",
  "rejected",
]);

export const TradingRuleConditionSchema = z.object({
  field: z.string().min(1).max(100),
  operator: z.enum([
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "contains",
    "starts_with",
    "ends_with",
  ]),
  value: z.union([z.string(), z.number(), z.boolean()]),
  description: z.string().max(500).optional(),
});

export const TradingRuleRiskLimitSchema = z.object({
  maxPositionSize: z.number().positive().optional(),
  maxLossPerTrade: z.number().nonnegative().optional(),
  maxDailyLoss: z.number().nonnegative().optional(),
  maxDrawdown: z.number().nonnegative().optional(),
  stopLossPercent: z.number().nonnegative().optional(),
  takeProfitPercent: z.number().nonnegative().optional(),
});

export const TradingRuleAssumptionSchema = z.object({
  assumption: z.string().min(1).max(500),
  confidence: z.enum(["low", "medium", "high"]).optional(),
});

export const TradingRuleEvidenceSchema = z.object({
  source: z.string().min(1).max(200),
  observation: z.string().min(1).max(1000),
  date: z.string().date().optional(),
});

export const TradingRuleWarningSchema = z.object({
  warning: z.string().min(1).max(500),
  severity: z.enum(["low", "medium", "high", "critical"]),
  mitigation: z.string().max(500).optional(),
});

export const TradingRuleApprovalRequirementSchema = z.object({
  requiresHumanReview: z.boolean().default(false),
  requiresComplianceCheck: z.boolean().default(false),
  requiresRiskAssessment: z.boolean().default(false),
  minReviewerLevel: z.enum(["junior", "senior", "lead"]).optional(),
});

export const CreateTradingRuleRequestSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  entryConditions: z.array(TradingRuleConditionSchema).default([]),
  exitConditions: z.array(TradingRuleConditionSchema).default([]),
  riskLimits: TradingRuleRiskLimitSchema.default({}),
  assumptions: z.array(TradingRuleAssumptionSchema).default([]),
  evidence: z.array(TradingRuleEvidenceSchema).default([]),
  warnings: z.array(TradingRuleWarningSchema).default([]),
  approvalRequirements: TradingRuleApprovalRequirementSchema.default({
    requiresHumanReview: false,
    requiresComplianceCheck: false,
    requiresRiskAssessment: false,
  }),
  naturalLanguageSummary: z.string().max(5000).optional(),
});

export const UpdateTradingRuleStatusRequestSchema = z.object({
  status: TradingRuleStatusSchema,
});

export const UpdateTradingRuleRequestSchema =
  CreateTradingRuleRequestSchema.partial();

export type TradingRuleStatus = z.infer<typeof TradingRuleStatusSchema>;
export type TradingRuleCondition = z.infer<typeof TradingRuleConditionSchema>;
export type TradingRuleRiskLimit = z.infer<typeof TradingRuleRiskLimitSchema>;
export type TradingRuleAssumption = z.infer<typeof TradingRuleAssumptionSchema>;
export type TradingRuleEvidence = z.infer<typeof TradingRuleEvidenceSchema>;
export type TradingRuleWarning = z.infer<typeof TradingRuleWarningSchema>;
export type CreateTradingRuleRequest = z.infer<
  typeof CreateTradingRuleRequestSchema
>;
