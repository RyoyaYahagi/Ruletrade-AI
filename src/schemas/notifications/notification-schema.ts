import { z } from "zod";

export const NotificationTypeSchema = z.enum([
  "rule_review_due",
  "rule_questions_pending",
  "rule_quality_gate_failed",
  "rule_finalizable",
  "watchlist_item_needs_rule",
  "watchlist_review_due",
  "portfolio_missing_rules",
  "portfolio_review_due",
  "holistic_review_ready",
  "document_extraction_completed",
  "document_summary_completed",
  "document_index_failed",
  "system_notice",
]);

export const NotificationSeveritySchema = z.enum([
  "info",
  "success",
  "warning",
  "error",
]);

export const NotificationTargetTypeSchema = z.enum([
  "rule_session",
  "watchlist_item",
  "portfolio",
  "portfolio_position",
  "document",
  "system",
]);

export const NotificationStatusSchema = z.enum([
  "queued",
  "delivered",
  "read",
  "dismissed",
  "failed",
  "cancelled",
]);

export const CreateNotificationSchema = z.object({
  notificationType: NotificationTypeSchema,
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(1000),
  severity: NotificationSeveritySchema.default("info"),
  targetType: NotificationTargetTypeSchema.optional(),
  targetId: z.string().uuid().optional(),
  actionUrl: z.string().max(1000).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  scheduledFor: z.string().datetime().optional(),
});

export type CreateNotification = z.infer<typeof CreateNotificationSchema>;
