import { z } from "zod";

export const ruleEvaluationOutputSchema = z.object({
  backtestWindow: z.string(),
  sampleSize: z.number(),
  expectedMaxDrawdown: z.string(),
  confidence: z.enum(["unverified", "low", "medium", "high"]),
  limitations: z.array(z.string()),
});

export type RuleEvaluationOutput = z.infer<typeof ruleEvaluationOutputSchema>;
