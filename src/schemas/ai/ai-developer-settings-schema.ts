import { z } from "zod";
import { AIProviderKeySchema } from "@/schemas/ai/ai-model-config-schema";

export const AiDeveloperSettingsSchema = z.object({
  provider: AIProviderKeySchema,
  model: z.string().trim().min(1).max(128),
});

export type AiDeveloperSettingsInput = z.infer<
  typeof AiDeveloperSettingsSchema
>;
