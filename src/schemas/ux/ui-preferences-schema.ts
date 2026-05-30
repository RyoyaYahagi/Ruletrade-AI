import { z } from "zod";

export const LocaleSchema = z.enum(["ja", "en"]);
export const ColorSchemeSchema = z.enum(["system", "light", "dark"]);

export const UiPreferencesSchema = z.object({
  locale: LocaleSchema.default("ja"),
  timezone: z.string().min(1).default("Asia/Tokyo"),
  colorScheme: ColorSchemeSchema.default("system"),
  reducedMotion: z.boolean().default(false),
  highContrast: z.boolean().default(false),
  largerText: z.boolean().default(false),
  compactMode: z.boolean().default(false),
  showAdvancedFields: z.boolean().default(false),
});

export type UiPreferences = z.infer<typeof UiPreferencesSchema>;
export type Locale = z.infer<typeof LocaleSchema>;
