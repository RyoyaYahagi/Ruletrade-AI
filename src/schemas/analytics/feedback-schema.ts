import { z } from "zod";

export const FeedbackTypeSchema = z.enum([
  "bug",
  "feature_request",
  "usability",
  "other",
]);

export const CreateFeedbackSchema = z.object({
  feedbackType: FeedbackTypeSchema,
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
});

export const FeedbackVoteSchema = z.object({
  feedbackId: z.string().uuid(),
  voteType: z.enum(["up", "down"]),
});

export type CreateFeedback = z.infer<typeof CreateFeedbackSchema>;
export type FeedbackVote = z.infer<typeof FeedbackVoteSchema>;
