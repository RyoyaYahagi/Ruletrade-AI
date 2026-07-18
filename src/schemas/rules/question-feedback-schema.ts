import { z } from "zod";

export const QuestionFeedbackQualitySchema = z.enum([
  "good",
  "needs_improvement",
]);

export const DraftEffortSchema = z.enum([
  "reduced",
  "unchanged",
  "increased",
  "not_used",
]);

export const QuestionFeedbackInputSchema = z
  .object({
    questionId: z.string().trim().min(1).max(100),
    questionQuality: QuestionFeedbackQualitySchema.nullable().optional(),
    choiceQuality: QuestionFeedbackQualitySchema.nullable().optional(),
    draftEffort: DraftEffortSchema.nullable().optional(),
    reason: z.string().trim().max(1000).nullable().optional(),
    draftRunId: z.string().trim().min(1).max(100).nullable().optional(),
  })
  .superRefine((value, context) => {
    if (
      !value.questionQuality &&
      !value.choiceQuality &&
      !value.draftEffort &&
      !value.reason
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["questionQuality"],
        message: "少なくとも1つの評価または理由を入力してください。",
      });
    }
  });

export type QuestionFeedbackInput = z.infer<
  typeof QuestionFeedbackInputSchema
>;

export type QuestionFeedbackRecord = {
  id: string;
  user_id: string;
  session_id: string;
  question_id: string;
  question_key: string;
  question_quality: z.infer<typeof QuestionFeedbackQualitySchema> | null;
  choice_quality: z.infer<typeof QuestionFeedbackQualitySchema> | null;
  draft_effort: z.infer<typeof DraftEffortSchema> | null;
  reason: string | null;
  draft_run_id: string | null;
  created_at: string;
  updated_at: string;
};
