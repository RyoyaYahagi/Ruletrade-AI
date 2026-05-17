import { z } from "zod";

export const ruleGenerationOutputSchema = z.object({
  title: z.string().min(1),
  market: z.string().min(1),
  timeframe: z.string().min(1),
  riskLevel: z.enum(["low", "medium", "high"]),
  entryConditions: z.array(z.string()),
  exitConditions: z.array(z.string()),
  riskLimits: z.array(z.string()),
  assumptions: z.array(z.string()),
});

export type RuleGenerationOutput = z.infer<typeof ruleGenerationOutputSchema>;
