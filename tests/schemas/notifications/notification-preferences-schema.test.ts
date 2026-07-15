import { describe, expect, it } from "vitest";
import { NotificationPreferencesSchema } from "@/schemas/notifications/notification-preferences-schema";

describe("NotificationPreferencesSchema", () => {
  it("applies all defaults when parsing an empty object", () => {
    const result = NotificationPreferencesSchema.safeParse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.inAppEnabled).toBe(true);
      expect(result.data.webPushEnabled).toBe(false);
      expect(result.data.emailEnabled).toBe(false);

      expect(result.data.ruleReviewRemindersEnabled).toBe(true);
      expect(result.data.pendingQuestionsEnabled).toBe(true);
      expect(result.data.watchlistRemindersEnabled).toBe(true);
      expect(result.data.portfolioRemindersEnabled).toBe(true);
      expect(result.data.documentNotificationsEnabled).toBe(true);

      expect(result.data.quietHoursEnabled).toBe(false);
      expect(result.data.quietHoursStart).toBeUndefined();
      expect(result.data.quietHoursEnd).toBeUndefined();

      expect(result.data.timezone).toBe("Asia/Tokyo");
      expect(result.data.maxNotificationsPerDay).toBe(5);
    }
  });

  it("accepts all fields explicitly provided", () => {
    const result = NotificationPreferencesSchema.safeParse({
      inAppEnabled: false,
      webPushEnabled: true,
      emailEnabled: true,
      ruleReviewRemindersEnabled: false,
      pendingQuestionsEnabled: false,
      watchlistRemindersEnabled: false,
      portfolioRemindersEnabled: false,
      documentNotificationsEnabled: false,
      quietHoursEnabled: true,
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      timezone: "America/New_York",
      maxNotificationsPerDay: 10,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.inAppEnabled).toBe(false);
      expect(result.data.webPushEnabled).toBe(true);
      expect(result.data.emailEnabled).toBe(true);
      expect(result.data.ruleReviewRemindersEnabled).toBe(false);
      expect(result.data.pendingQuestionsEnabled).toBe(false);
      expect(result.data.watchlistRemindersEnabled).toBe(false);
      expect(result.data.portfolioRemindersEnabled).toBe(false);
      expect(result.data.documentNotificationsEnabled).toBe(false);
      expect(result.data.quietHoursEnabled).toBe(true);
      expect(result.data.quietHoursStart).toBe("22:00");
      expect(result.data.quietHoursEnd).toBe("07:00");
      expect(result.data.timezone).toBe("America/New_York");
      expect(result.data.maxNotificationsPerDay).toBe(10);
    }
  });

  it("rejects maxNotificationsPerDay below 0", () => {
    const result = NotificationPreferencesSchema.safeParse({
      maxNotificationsPerDay: -1,
    });

    expect(result.success).toBe(false);
  });

  it("rejects maxNotificationsPerDay above 50", () => {
    const result = NotificationPreferencesSchema.safeParse({
      maxNotificationsPerDay: 51,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-integer maxNotificationsPerDay", () => {
    const result = NotificationPreferencesSchema.safeParse({
      maxNotificationsPerDay: 5.5,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-boolean value for inAppEnabled", () => {
    const result = NotificationPreferencesSchema.safeParse({
      inAppEnabled: "yes",
    });

    expect(result.success).toBe(false);
  });
});
