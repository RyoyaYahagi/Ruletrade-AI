import { z } from "zod";

const percentage = z.number().min(0).max(100).nullable();

export const AppSettingsInputSchema = z.object({
  satelliteCapPct: percentage,
  satelliteWarnPct: percentage,
});

export const AppSettingsSchema = AppSettingsInputSchema.extend({
  id: z.literal("default").default("default"),
  updatedAt: z.string().datetime(),
});

export type AppSettingsInput = z.infer<typeof AppSettingsInputSchema>;
export type AppSettings = z.infer<typeof AppSettingsSchema>;
