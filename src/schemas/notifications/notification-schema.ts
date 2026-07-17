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
  "document_extraction_completed",
  "document_summary_completed",
  "document_index_failed",
  "system_notice",
  "ai_budget_warning",
  "rule_price_condition_met",
  "price_data_stale",
  "portfolio_drift_exceeded",
  "news_thesis_impact",
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
  "news_item",
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

export const RuleAlertResolutionSchema = z.object({
  resolution: z.enum(["kept", "revising"]),
});
