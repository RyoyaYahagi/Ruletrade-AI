import { z } from "zod";

export const RuleQuestionTypeSchema = z.enum([
  "single_choice",
  "multiple_choice",
  "free_text",
  "number",
  "price_range",
  "date",
  "yes_no",
]);

export const RuleQuestionOptionSchema = z.object({
  label: z.string().min(1).max(200),
  value: z.string().min(1).max(200),
});

export const RuleQuestionSourceSchema = z.enum(["template", "ai", "system"]);

export const RuleQuestionStatusSchema = z.enum([
  "pending",
  "answered",
  "skipped",
  "dismissed",
]);

export const RuleQuestionSchema = z.object({
  questionKey: z.string().min(1).max(100),
  questionText: z.string().min(1).max(1000),
  questionType: RuleQuestionTypeSchema,
  options: z.array(RuleQuestionOptionSchema).optional(),
  helpText: z.string().max(2000).optional(),
  priority: z.number().int().min(1).max(5).default(1),
  isRequired: z.boolean().default(true),
  mapsToRuleField: z.string().max(200).optional(),
  source: RuleQuestionSourceSchema.default("ai"),
  status: RuleQuestionStatusSchema.default("pending"),
  displayOrder: z.number().int().min(0).default(0),
});

export type RuleQuestion = z.infer<typeof RuleQuestionSchema>;

