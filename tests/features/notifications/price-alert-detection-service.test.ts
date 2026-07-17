import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildPriceAlertMessage,
  buildStalePriceAlertMessage,
  PRICE_ALERT_CONDITION_KEYS,
} from "@/features/notifications/constants/price-alert-messages";
import { detectProhibitedPhrases } from "@/lib/safety/detect-prohibited-phrases";

type DatabaseClient = import("@/lib/db/database-client").DatabaseClient;

describe("detectPriceAlerts", () => {
  const originalDatabasePath = process.env.SQLITE_DATABASE_PATH;
  let tempDir: string;
  let db: DatabaseClient;
  let detectPriceAlerts: typeof import("@/features/notifications/services/price-alert-detection-service").detectPriceAlerts;
  let resolveRuleAlert: typeof import("@/features/notifications/services/notification-service").resolveRuleAlert;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ruletrade-price-alert-"));
    process.env.SQLITE_DATABASE_PATH = path.join(tempDir, "test.sqlite");
    vi.resetModules();
    const databaseModule = await import("@/lib/db/database-client");
    const serviceModule = await import(
      "@/features/notifications/services/price-alert-detection-service"
    );
    const notificationModule = await import(
      "@/features/notifications/services/notification-service"
    );
    db = await databaseModule.createDatabaseClient();
    detectPriceAlerts = serviceModule.detectPriceAlerts;
    resolveRuleAlert = notificationModule.resolveRuleAlert;
  });

  afterEach(() => {
    process.env.SQLITE_DATABASE_PATH = originalDatabasePath;
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.resetModules();
  });

  it("creates a stop-loss review notification at the threshold", async () => {
    await seedSessionAndPosition();
    await seedQuote("2026-07-16", 840);

    const result = await detectPriceAlerts({ userId: "user-a" });

    expect(result.createdCount).toBe(1);
    const notifications = await db
      .from("notifications")
      .select("notification_type, user_id")
      .eq("user_id", "user-a");
    expect(notifications.data).toHaveLength(1);
    expect(notifications.data?.[0]).toMatchObject({
      notification_type: "rule_price_condition_met",
      user_id: "user-a",
    });
  });

  it("does not duplicate a notification for the same rule and quote date", async () => {
    await seedSessionAndPosition();
    await seedQuote("2026-07-16", 840);

    expect((await detectPriceAlerts({ userId: "user-a" })).createdCount).toBe(1);
    expect((await detectPriceAlerts({ userId: "user-a" })).createdCount).toBe(0);

    const events = await db
      .from("rule_alert_events")
      .select("id")
      .eq("user_id", "user-a");
    expect(events.data).toHaveLength(1);
  });

  it("suppresses an alert while the previous quote already met the condition", async () => {
    await seedSessionAndPosition();
    await seedQuote("2026-07-15", 830);
    await seedQuote("2026-07-16", 820);

    const result = await detectPriceAlerts({ userId: "user-a" });

    expect(result.createdCount).toBe(0);
  });

  it("creates an alert when the threshold is crossed from the previous quote", async () => {
    await seedSessionAndPosition();
    await seedQuote("2026-07-15", 900);
    await seedQuote("2026-07-16", 840);

    const result = await detectPriceAlerts({ userId: "user-a" });

    expect(result.createdCount).toBe(1);
  });

  it("creates a target price notification", async () => {
    await seedSessionAndPosition({
      ruleJson: { exitPlan: { targetPrice: 2000 } },
    });
    await seedQuote("2026-07-16", 2010);

    const result = await detectPriceAlerts({ userId: "user-a" });

    expect(result.createdCount).toBe(1);
    const event = await db
      .from("rule_alert_events")
      .select("condition_key")
      .eq("user_id", "user-a")
      .single();
    expect(event.data?.condition_key).toBe("target_price_reached");
  });

  it("does not use an absent position for stop-loss alerts", async () => {
    await seedSession({
      ruleJson: { monitoring: { stopLossReviewPercent: 15 } },
    });
    await seedQuote("2026-07-16", 840);

    const result = await detectPriceAlerts({ userId: "user-a" });

    expect(result.createdCount).toBe(0);
  });

  it("skips malformed rules while continuing with valid sessions", async () => {
    await seedSessionAndPosition();
    await seedSession({
      sessionId: "session-invalid",
      ruleJson: { monitoring: { stopLossReviewPercent: "invalid" } },
    });
    await seedQuote("2026-07-16", 840);

    const result = await detectPriceAlerts({ userId: "user-a" });

    expect(result).toMatchObject({ createdCount: 1, skippedRuleCount: 1 });
  });

  it("does not use another user's position or rule", async () => {
    await seedSessionAndPosition({ userId: "user-a", sessionId: "session-a" });
    await seedSessionAndPosition({ userId: "user-b", sessionId: "session-b" });
    await seedQuote("2026-07-16", 840);

    const result = await detectPriceAlerts({ userId: "user-a" });

    expect(result.createdCount).toBe(1);
    const otherUserNotifications = await db
      .from("notifications")
      .select("id")
      .eq("user_id", "user-b");
    expect(otherUserNotifications.data).toHaveLength(0);
  });

  it("keeps generated price alert messages free of prohibited recommendation wording", () => {
    const conditionMessages = PRICE_ALERT_CONDITION_KEYS.filter(
      (conditionKey) => conditionKey !== "price_data_stale",
    ).map((conditionKey) =>
      buildPriceAlertMessage({
        companyName: "A社",
        ticker: "7203",
        conditionKey,
        price: 840,
        threshold: 15,
        targetPrice: 850,
        dailyDropPercent: 8,
        cooldownHours: 24,
      }),
    );
    const messages = [
      ...conditionMessages,
      buildStalePriceAlertMessage({
        companyName: "A社",
        ticker: "7203",
        staleDays: 4,
      }),
    ];

    expect(messages.flatMap((message) => detectProhibitedPhrases(message))).toEqual(
      [],
    );
  });

  it("does not resolve another user's price alert", async () => {
    const notification = await db
      .from("notifications")
      .insert({
        user_id: "user-a",
        notification_type: "rule_price_condition_met",
        title: "価格条件を確認してください",
        body: "ルールを確認してください。",
        status: "queued",
      })
      .select("id")
      .single();
    await db.from("rule_alert_events").insert({
      user_id: "user-a",
      session_id: "session-a",
      condition_key: "stop_loss_review",
      quote_date: "2026-07-16",
      notification_id: notification.data?.id,
    });

    await expect(
      resolveRuleAlert({
        userId: "user-b",
        notificationId: notification.data?.id,
        resolution: "kept",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  async function seedSessionAndPosition(params: {
    userId?: string;
    sessionId?: string;
    ruleJson?: unknown;
  } = {}) {
    await seedSession(params);
    const userId = params.userId ?? "user-a";
    await db.from("portfolio_positions").insert({
      user_id: userId,
      ticker: "7203",
      market: "JP",
      average_cost: 1000,
      position_status: "active",
    });
  }

  async function seedSession(params: {
    userId?: string;
    sessionId?: string;
    ruleJson?: unknown;
  } = {}) {
    const userId = params.userId ?? "user-a";
    const sessionId = params.sessionId ?? "session-a";
    await db.from("rule_design_sessions").insert({
      id: sessionId,
      user_id: userId,
      ticker: "7203",
      company_name: "A社",
      market: "JP",
      status: "finalized",
      rule_json: params.ruleJson ?? {
        monitoring: { stopLossReviewPercent: 15 },
      },
    });
  }

  async function seedQuote(quoteDate: string, closePrice: number) {
    await db.from("price_quotes").insert({
      symbol: "7203",
      market: "JP",
      quote_date: quoteDate,
      close_price: closePrice,
      source: "mock",
    });
  }
});
