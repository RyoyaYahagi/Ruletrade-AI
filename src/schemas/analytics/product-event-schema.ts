import { z } from "zod";

export const ProductEventNameSchema = z.enum([
  "page_view",
  "rule_session_created",
  "rule_session_completed",
  "ai_review_requested",
  "ai_review_safety_blocked",
  "watchlist_item_created",
  "watchlist_to_rule_session",
  "document_uploaded",
  "document_extraction_failed",
  "document_indexed",
  "portfolio_created",
  "notification_clicked",
  "privacy_setting_changed",
  "billing_plan_viewed",
  "account_deletion_requested",
]);

export const TrackProductEventSchema = z.object({
  eventName: ProductEventNameSchema,
  properties: z.record(z.string(), z.unknown()).optional(),
  sessionId: z.string().optional(),
});

export type TrackProductEvent = z.infer<typeof TrackProductEventSchema>;
