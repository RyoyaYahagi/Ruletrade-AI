import { z } from "zod";

export const RuleReviewSchema = z.object({
  summary: z.string().min(1),
  completionScore: z.number().min(0).max(100),
  needsMoreInfo: z.boolean(),
  canFinalize: z.boolean(),
  qualityChecks: z.array(
    z.object({
      checkKey: z.string().min(1),
      label: z.string().min(1),
      status: z.enum(["pass", "warning", "fail"]),
      severity: z.enum(["low", "medium", "high"]),
      reason: z.string().min(1),
      suggestedQuestion: z.string().min(1).optional(),
    }),
  ),
  nextQuestions: z.array(
    z.object({
      questionKey: z.string().min(1),
      questionText: z.string().min(1),
      questionType: z.enum(["free_text", "single_choice", "multi_choice"]),
      priority: z.number().int().min(1).max(5),
      isRequired: z.boolean(),
      mapsToRuleField: z.string().min(1).optional(),
      source: z.enum(["ai", "system", "user"]),
      status: z.enum(["pending", "answered", "skipped"]),
      displayOrder: z.number().int().min(0),
    }),
  ),
  suggestedRuleUpdates: z.array(z.unknown()),
  safety: z.object({
    passed: z.boolean(),
    riskLevel: z.enum(["low", "medium", "high"]),
    violations: z.array(z.string()),
    prohibitedPhrasesDetected: z.array(z.string()),
  }),
});

export const ruleReviewOutputSchema = RuleReviewSchema;

export type RuleReviewOutput = z.infer<typeof RuleReviewSchema>;
