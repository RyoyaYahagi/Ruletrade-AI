import { z } from "zod";

export const ruleReviewOutputSchema = z.object({
  warnings: z.array(
    z.object({
      id: z.string(),
      severity: z.enum(["info", "warning", "blocker"]),
      title: z.string(),
      detail: z.string(),
      owner: z.enum(["risk_reviewer"]),
    }),
  ),
});

export type RuleReviewOutput = z.infer<typeof ruleReviewOutputSchema>;
