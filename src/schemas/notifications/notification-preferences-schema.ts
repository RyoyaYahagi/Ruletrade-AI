import { z } from "zod";

export const NotificationPreferencesSchema = z.object({
  inAppEnabled: z.boolean().default(true),
  webPushEnabled: z.boolean().default(false),
  emailEnabled: z.boolean().default(false),

  ruleReviewRemindersEnabled: z.boolean().default(true),
  pendingQuestionsEnabled: z.boolean().default(true),
  watchlistRemindersEnabled: z.boolean().default(true),
  portfolioRemindersEnabled: z.boolean().default(true),
  documentNotificationsEnabled: z.boolean().default(true),

  quietHoursEnabled: z.boolean().default(false),
  quietHoursStart: z.string().optional(),
  quietHoursEnd: z.string().optional(),

  timezone: z.string().default("Asia/Tokyo"),

  maxNotificationsPerDay: z.number().int().min(0).max(50).default(5),
});

export type NotificationPreferences = z.infer<
  typeof NotificationPreferencesSchema
>;
