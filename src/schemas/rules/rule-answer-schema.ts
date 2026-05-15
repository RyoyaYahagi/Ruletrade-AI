import { z } from "zod";

export const RuleAnswerJsonSchema = z.union([
  z.object({
    value: z.string(),
    label: z.string().optional(),
  }),
  z.object({
    values: z.array(z.string()),
  }),
  z.object({
    min: z.number().nonnegative().optional(),
    max: z.number().nonnegative().optional(),
    currency: z.string().optional(),
  }),
  z.object({
    value: z.number(),
  }),
  z.object({
    text: z.string(),
  }),
  z.record(z.string(), z.unknown()),
]);

export const RuleAnswerSchema = z.object({
  questionKey: z.string().min(1).max(100),
  answerText: z.string().max(4000).optional(),
  answerJson: RuleAnswerJsonSchema.default({}),
});

export type RuleAnswer = z.infer<typeof RuleAnswerSchema>;
