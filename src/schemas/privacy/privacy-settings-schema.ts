import { z } from "zod";

export const PrivacySettingsSchema = z.object({
  aiMemoryEnabled: z.boolean().default(true),
  aiLoggingEnabled: z.boolean().default(true),
  aiPayloadLoggingEnabled: z.boolean().default(false),

  allowRagIndexing: z.boolean().default(true),
  allowDocumentIndexing: z.boolean().default(true),

  dataRetentionDays: z.number().int().min(0).optional(),
});

export type PrivacySettings = z.infer<typeof PrivacySettingsSchema>;
