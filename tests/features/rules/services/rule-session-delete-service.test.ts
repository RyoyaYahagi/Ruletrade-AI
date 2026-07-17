import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type DatabaseClient = import("@/lib/db/database-client").DatabaseClient;

describe("deleteRuleSession", () => {
  const originalDatabasePath = process.env.SQLITE_DATABASE_PATH;
  let tempDir: string;
  let db: DatabaseClient;
  let deleteRuleSession: typeof import("@/features/rules/services/rule-session-service").deleteRuleSession;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "ruletrade-delete-session-"),
    );
    process.env.SQLITE_DATABASE_PATH = path.join(tempDir, "test.sqlite");
    vi.resetModules();
    const databaseModule = await import("@/lib/db/database-client");
    const serviceModule =
      await import("@/features/rules/services/rule-session-service");
    db = await databaseModule.createDatabaseClient();
    deleteRuleSession = serviceModule.deleteRuleSession;
  });

  afterEach(() => {
    process.env.SQLITE_DATABASE_PATH = originalDatabasePath;
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.resetModules();
  });

  it("deletes the owned session and all session-scoped records", async () => {
    await createSession("session-a", "user-a");
    await createSession("session-b", "user-b");
    await db.from("portfolio_positions").insert([
      {
        id: "position-a",
        user_id: "user-a",
        ticker: "AAA",
        currency: "JPY",
        asset_type: "stock",
        market_value: 1000,
        position_status: "active",
        rule_session_id: "session-a",
      },
      {
        id: "position-b",
        user_id: "user-b",
        ticker: "BBB",
        currency: "JPY",
        asset_type: "stock",
        market_value: 2000,
        position_status: "active",
        rule_session_id: "session-a",
      },
    ]);

    await db.from("rule_versions").insert({
      id: "version-a",
      user_id: "user-a",
      session_id: "session-a",
      version_number: 1,
      rule_json: {},
      created_by: "user",
    });
    await db.from("rule_questions").insert({
      id: "question-a",
      user_id: "user-a",
      session_id: "session-a",
      question_key: "time_horizon",
      question_text: "期間は？",
      question_type: "single_choice",
    });
    await db.from("rule_answers").insert({
      id: "answer-a",
      user_id: "user-a",
      session_id: "session-a",
      question_id: "question-a",
      question_key: "time_horizon",
      answer_json: { value: "long_term" },
    });
    await db.from("rule_reviews").insert({
      id: "review-a",
      user_id: "user-a",
      session_id: "session-a",
      provider: "mock",
      model: "mock",
      prompt_version: "test",
      review_json: {},
    });
    await db.from("rule_quality_checks").insert({
      id: "check-a",
      user_id: "user-a",
      session_id: "session-a",
      review_id: "review-a",
      check_key: "missing_thesis",
      label: "仮説",
      status: "warning",
      severity: "warning",
      reason: "未設定",
    });
    await db.from("rule_alert_events").insert({
      id: "alert-a",
      user_id: "user-a",
      session_id: "session-a",
      condition_key: "stop_loss",
      quote_date: "2026-07-17",
      notification_id: "notification-a",
    });
    await db.from("news_assessments").insert({
      id: "assessment-a",
      user_id: "user-a",
      news_item_id: "news-a",
      session_id: "session-a",
      relevance: "affects_thesis",
      notification_id: "notification-b",
    });
    await db.from("notifications").insert([
      { id: "notification-a", user_id: "user-a", title: "通知A" },
      { id: "notification-b", user_id: "user-a", title: "通知B" },
    ]);
    await db.from("notification_delivery_logs").insert({
      id: "delivery-a",
      user_id: "user-a",
      notification_id: "notification-a",
    });
    await db.from("rag_documents").insert({
      id: "rag-document-a",
      user_id: "user-a",
      source_type: "rule_session",
      source_id: "session-a",
      title: "ルール",
      content: "内容",
    });
    await db.from("rag_chunks").insert({
      id: "rag-chunk-a",
      user_id: "user-a",
      document_id: "rag-document-a",
      source_type: "rule_session",
      source_id: "session-a",
      chunk_index: 0,
      content: "内容",
    });

    await deleteRuleSession({ userId: "user-a", sessionId: "session-a" });

    await expectRows("rule_design_sessions", "session-a", 0);
    const clearedPosition = await db
      .from("portfolio_positions")
      .select("rule_session_id")
      .eq("id", "position-a")
      .single();
    expect(clearedPosition.data?.rule_session_id).toBeNull();

    const otherUserPosition = await db
      .from("portfolio_positions")
      .select("rule_session_id")
      .eq("id", "position-b")
      .single();
    expect(otherUserPosition.data?.rule_session_id).toBe("session-a");

    await expectRows("rule_questions", "session-a", 0);
    await expectRows("rule_answers", "session-a", 0);
    await expectRows("rule_reviews", "session-a", 0);
    await expectRows("rule_quality_checks", "session-a", 0);
    await expectRows("rule_alert_events", "session-a", 0);
    await expectRows("news_assessments", "session-a", 0);
    await expectRows("rag_documents", "session-a", 0, "source_id");
    await expectRows("rag_chunks", "session-a", 0, "source_id");
    await expectRows("notifications", "notification-a", 0);
    await expectRows(
      "notification_delivery_logs",
      "notification-a",
      0,
      "notification_id",
    );

    const otherUserSession = await db
      .from("rule_design_sessions")
      .select("id")
      .eq("id", "session-b")
      .single();
    expect(otherUserSession.data?.id).toBe("session-b");
  });

  it("rejects another user's session without deleting it", async () => {
    await createSession("session-a", "user-a");

    await expect(
      deleteRuleSession({ userId: "user-b", sessionId: "session-a" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });

    const result = await db
      .from("rule_design_sessions")
      .select("id")
      .eq("id", "session-a")
      .single();
    expect(result.data?.id).toBe("session-a");
  });

  it("deletes the session when a legacy rag_chunks table lacks source_id", async () => {
    await createSession("session-a", "user-a");
    await db.from("rag_chunks").insert({
      id: "legacy-chunk",
      user_id: "user-a",
      source_type: "rule_session",
    });

    await deleteRuleSession({ userId: "user-a", sessionId: "session-a" });

    const deletedSession = await db
      .from("rule_design_sessions")
      .select("id")
      .eq("id", "session-a")
      .single();
    expect(deletedSession.data).toBeNull();

    const legacyChunk = await db
      .from("rag_chunks")
      .select("id")
      .eq("id", "legacy-chunk")
      .single();
    expect(legacyChunk.data?.id).toBe("legacy-chunk");
  });

  async function createSession(id: string, userId: string) {
    const result = await db.from("rule_design_sessions").insert({
      id,
      user_id: userId,
      ticker: "7203",
      status: "in_progress",
      rule_json: {},
    });
    expect(result.error).toBeNull();
  }

  async function expectRows(
    table: string,
    value: string,
    expectedCount: number,
    column = "id",
  ) {
    const result = await db.from(table).select("id").eq(column, value);
    expect(result.data).toHaveLength(expectedCount);
  }
});
