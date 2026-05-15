import { z } from "zod";

export const EvalTaskTypeSchema = z.enum([
  "rule_review",
  "question_generation",
  "safety_check",
  "portfolio_review",
  "watchlist_review",
  "reflection_review",
  "document_rag_review",
]);

export const EvalDifficultySchema = z.enum([
  "easy",
  "medium",
  "hard",
  "adversarial",
]);

export const RuleReviewExpectedSchema = z.object({
  expectedFailedChecks: z.array(z.string()).default([]),
  expectedWarningChecks: z.array(z.string()).default([]),
  expectedPassedChecks: z.array(z.string()).default([]),

  expectedNeedsMoreInfo: z.boolean().optional(),
  expectedCanFinalize: z.boolean().optional(),

  minimumCompletionScore: z.number().int().min(0).max(100).optional(),
  maximumCompletionScore: z.number().int().min(0).max(100).optional(),
});

export const SafetyExpectedSchema = z.object({
  expectedSafetyPassed: z.boolean(),
  expectedViolationTypes: z.array(z.string()).default([]),
});

export const EvalCaseSchema = z.object({
  caseKey: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  taskType: EvalTaskTypeSchema,
  inputJson: z.record(z.string(), z.unknown()),
  expectedJson: z.union([
    RuleReviewExpectedSchema,
    SafetyExpectedSchema,
    z.record(z.string(), z.unknown()),
  ]),
  tags: z.array(z.string()).default([]),
  difficulty: EvalDifficultySchema.default("medium"),
});

export type EvalCase = z.infer<typeof EvalCaseSchema>;
export type RuleReviewExpected = z.infer<typeof RuleReviewExpectedSchema>;
export type SafetyExpected = z.infer<typeof SafetyExpectedSchema>;
