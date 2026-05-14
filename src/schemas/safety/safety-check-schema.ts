import { z } from "zod";

export const SafetyRiskLevelSchema = z.enum(["low", "medium", "high"]);

export const SafetyViolationTypeSchema = z.enum([
  "buy_recommendation",
  "sell_recommendation",
  "price_prediction",
  "profit_guarantee",
  "loss_avoidance_guarantee",
  "decision_delegation",
  "urgency_pressure",
  "fear_mongering",
  "privacy_risk",
  "other",
]);

export const SafetyCheckSchema = z.object({
  passed: z.boolean(),
  riskLevel: SafetyRiskLevelSchema,
  violations: z
    .array(
      z.object({
        type: SafetyViolationTypeSchema,
        phrase: z.string().optional(),
        reason: z.string().min(1),
      })
    )
    .default([]),
  prohibitedPhrasesDetected: z.array(z.string()).default([]),
  suggestedRewrite: z.string().optional(),
});

export type SafetyCheck = z.infer<typeof SafetyCheckSchema>;
