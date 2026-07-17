import { describe, expect, it } from "vitest";
import {
  CreateNotificationSchema,
  NotificationTypeSchema,
} from "@/schemas/notifications/notification-schema";

const validNotification = {
  notificationType: "rule_review_due",
  title: "ルールレビュー期限のお知らせ",
  body: "ルール #123 のレビュー期限が近づいています。",
  severity: "info",
  metadata: {},
};

describe("CreateNotificationSchema", () => {
  it("accepts a valid notification with minimum required fields", () => {
    const result = CreateNotificationSchema.safeParse(validNotification);

    expect(result.success).toBe(true);
  });

  it("accepts a valid notification with all optional fields", () => {
    const result = CreateNotificationSchema.safeParse({
      ...validNotification,
      targetType: "rule_session",
      targetId: "550e8400-e29b-41d4-a716-446655440000",
      actionUrl: "https://example.com/notifications/123",
      scheduledFor: "2026-05-21T10:00:00Z",
    });

    expect(result.success).toBe(true);
  });

  it("applies default severity and metadata", () => {
    const result = CreateNotificationSchema.safeParse({
      notificationType: "system_notice",
      title: "System notice",
      body: "システムメンテナンスのお知らせ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.severity).toBe("info");
      expect(result.data.metadata).toEqual({});
    }
  });

  it("rejects an empty title", () => {
    const result = CreateNotificationSchema.safeParse({
      ...validNotification,
      title: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a title exceeding 200 characters", () => {
    const result = CreateNotificationSchema.safeParse({
      ...validNotification,
      title: "a".repeat(201),
    });

    expect(result.success).toBe(false);
  });

  it("rejects an empty body", () => {
    const result = CreateNotificationSchema.safeParse({
      ...validNotification,
      body: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a body exceeding 1000 characters", () => {
    const result = CreateNotificationSchema.safeParse({
      ...validNotification,
      body: "a".repeat(1001),
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid notification type", () => {
    const result = CreateNotificationSchema.safeParse({
      ...validNotification,
      notificationType: "invalid_type",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid severity", () => {
    const result = CreateNotificationSchema.safeParse({
      ...validNotification,
      severity: "critical",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid target type", () => {
    const result = CreateNotificationSchema.safeParse({
      ...validNotification,
      targetType: "user",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid targetId", () => {
    const result = CreateNotificationSchema.safeParse({
      ...validNotification,
      targetType: "rule_session",
      targetId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an actionUrl exceeding 1000 characters", () => {
    const result = CreateNotificationSchema.safeParse({
      ...validNotification,
      actionUrl: "https://example.com/" + "a".repeat(981),
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid datetime format for scheduledFor", () => {
    const result = CreateNotificationSchema.safeParse({
      ...validNotification,
      scheduledFor: "2026-05-21",
    });

    expect(result.success).toBe(false);
  });
});

describe("NotificationTypeSchema", () => {
  it("全フェーズの通知種別を受け付ける", () => {
    const types = [
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
      "ai_budget_warning",
      "rule_price_condition_met",
      "price_data_stale",
      "portfolio_drift_exceeded",
      "news_thesis_impact",
    ] as const;

    for (const type of types) {
      expect(NotificationTypeSchema.safeParse(type).success).toBe(true);
    }
  });
});
