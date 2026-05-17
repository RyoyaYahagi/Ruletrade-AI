import { z } from "zod";

export const EvalMetricsSchema = z.object({
  truePositive: z.number().int().nonnegative(),
  falsePositive: z.number().int().nonnegative(),
  falseNegative: z.number().int().nonnegative(),

  precision: z.number().min(0).max(1),
  recall: z.number().min(0).max(1),
  f1: z.number().min(0).max(1),
});

export type EvalMetrics = z.infer<typeof EvalMetricsSchema>;
