import { z } from "zod";

export const AiExperimentStatusSchema = z.enum([
  "in_progress",
  "validated",
  "blocked",
  "archived",
]);

export const CreateAiExperimentSchema = z.object({
  title: z.string().trim().min(1).max(160),
  hypothesis: z.string().trim().min(1).max(4000),
  changeSummary: z.string().trim().min(1).max(6000),
  result: z.string().trim().max(6000).default(""),
  blockedOn: z.string().trim().max(4000).default(""),
  nextStep: z.string().trim().max(4000).default(""),
  status: AiExperimentStatusSchema.default("in_progress"),
  promptVersion: z.string().trim().max(128).default(""),
  provider: z.string().trim().max(64).default(""),
  model: z.string().trim().max(128).default(""),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
});

export type CreateAiExperimentInput = z.infer<typeof CreateAiExperimentSchema>;
