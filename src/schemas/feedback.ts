import { z } from "zod";

export const feedbackCategorySchema = z.enum([
  "bug",
  "ux_problem",
  "feature_request",
  "data_problem",
  "question",
  "other",
]);
export const feedbackAreaSchema = z.enum([
  "recording",
  "ai",
  "decisions",
  "transactions",
  "import",
  "export",
  "stock_detail",
  "ui",
  "other",
  "unknown",
]);
export const feedbackInputSchema = z.object({
  message: z
    .string()
    .max(10000)
    .refine((value) => value.trim().length > 0),
  inputMethod: z.enum(["text", "voice"]),
});

export const feedbackClassificationSchema = z.discriminatedUnion(
  "classificationSource",
  [
    z.object({
      category: feedbackCategorySchema,
      area: feedbackAreaSchema,
      severity: z.number().int().min(0).max(3),
      needsClarification: z.boolean(),
      classificationSource: z.literal("jev"),
    }),
    z.object({
      category: z.literal("other"),
      area: z.literal("unknown"),
      severity: z.null(),
      needsClarification: z.null(),
      classificationSource: z.literal("none"),
    }),
  ],
);
export const feedbackMetadataSchema = z.intersection(
  feedbackClassificationSchema,
  z.object({ inputMethod: feedbackInputSchema.shape.inputMethod }),
);
export type FeedbackInput = z.infer<typeof feedbackInputSchema>;
export type FeedbackClassification = z.infer<
  typeof feedbackClassificationSchema
>;
export const unclassifiedFeedback: FeedbackClassification = {
  category: "other",
  area: "unknown",
  severity: null,
  needsClarification: null,
  classificationSource: "none",
};
