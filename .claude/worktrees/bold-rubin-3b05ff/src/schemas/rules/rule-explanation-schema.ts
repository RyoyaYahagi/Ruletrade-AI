import { z } from "zod";

export const ruleExplanationOutputSchema = z.object({
  summary: z.string(),
  keyRisks: z.array(z.string()),
  evidenceSummary: z.string(),
  unresolvedBlockers: z.array(z.string()),
  nextRecommendedAction: z.string(),
});

export type RuleExplanationOutput = z.infer<typeof ruleExplanationOutputSchema>;
