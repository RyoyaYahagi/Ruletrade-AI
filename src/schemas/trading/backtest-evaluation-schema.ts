import { z } from "zod";

export const BacktestEvaluationStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
]);

export const BacktestKnownFailureCaseSchema = z.object({
  scenario: z.string().min(1).max(500),
  impact: z.enum(["low", "medium", "high", "critical"]),
  description: z.string().max(1000).optional(),
});

export const BacktestLimitationSchema = z.object({
  limitation: z.string().min(1).max(500),
  severity: z.enum(["low", "medium", "high"]).optional(),
});

export const CreateBacktestEvaluationRequestSchema = z.object({
  ruleId: z.string().uuid(),
  testWindowStart: z.string().date().optional(),
  testWindowEnd: z.string().date().optional(),
  sampleSize: z.number().int().positive().optional(),
  totalReturnPercent: z.number().optional(),
  annualizedReturnPercent: z.number().optional(),
  maxDrawdownPercent: z.number().optional(),
  sharpeRatio: z.number().optional(),
  winRatePercent: z.number().min(0).max(100).optional(),
  confidenceLevel: z.number().min(0).max(1).optional(),
  confidenceDescription: z.string().max(1000).optional(),
  knownFailureCases: z.array(BacktestKnownFailureCaseSchema).default([]),
  limitations: z.array(BacktestLimitationSchema).default([]),
});

export const UpdateBacktestEvaluationStatusRequestSchema = z.object({
  status: BacktestEvaluationStatusSchema,
});

export type BacktestEvaluationStatus = z.infer<
  typeof BacktestEvaluationStatusSchema
>;
export type BacktestKnownFailureCase = z.infer<
  typeof BacktestKnownFailureCaseSchema
>;
export type CreateBacktestEvaluationRequest = z.infer<
  typeof CreateBacktestEvaluationRequestSchema
>;
