import { z } from "zod";

export const notificationTypeSchema = z.enum([
  "review_reminder",
  "unanswered_question",
  "unconfigured_rule",
  "watchlist_rule_session_pending",
  "portfolio_review_pending",
  "document_summary_complete",
]);

export const notificationSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  type: notificationTypeSchema,
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  action_url: z.string().url().nullable().optional(),
  is_read: z.boolean().default(false),
  read_at: z.string().datetime().nullable().optional(),
  created_at: z.string().datetime(),
});

export const notificationPreferencesSchema = z.object({
  user_id: z.string().uuid(),
  review_reminders_enabled: z.boolean().default(true),
  unread_items_reminders_enabled: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const createNotificationSchema = notificationSchema
  .omit({ id: true, created_at: true, read_at: true })
  .extend({
    is_read: z.boolean().default(false),
  });

export const markNotificationReadSchema = z.object({
  is_read: z.literal(true),
});

export type Notification = z.infer<typeof notificationSchema>;
export type NotificationPreferences = z.infer<
  typeof notificationPreferencesSchema
>;
export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
