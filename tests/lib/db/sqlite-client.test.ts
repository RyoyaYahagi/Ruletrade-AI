import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

describe("createSqliteClient", () => {
  const originalEnv = { ...process.env };
  const tempDirs: string[] = [];

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
    for (const tempDir of tempDirs.splice(0)) {
      fs.rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("updates tables that do not have updated_at columns", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ruletrade-sqlite-"));
    tempDirs.push(tempDir);
    process.env.SQLITE_DATABASE_PATH = path.join(tempDir, "test.sqlite");

    const { createSqliteClient } = await import("@/lib/db/sqlite-client");
    const client = createSqliteClient();

    const insertResult = await client.from("rule_questions").insert({
      user_id: "user-1",
      session_id: "session-1",
      question_key: "investment_thesis",
      question_text: "この銘柄を買いたい理由は何ですか？",
      question_type: "free_text",
      status: "pending",
      display_order: 1,
    });

    const question = Array.isArray(insertResult.data)
      ? insertResult.data[0]
      : insertResult.data;
    expect(question).toMatchObject({ status: "pending" });

    const updateResult = await client
      .from("rule_questions")
      .update({ status: "answered", answered_at: "2026-07-04T03:21:03.000Z" })
      .eq("id", question?.id)
      .eq("user_id", "user-1");

    expect(updateResult.error).toBeNull();

    const fetchResult = await client
      .from("rule_questions")
      .select("id, status, answered_at")
      .eq("id", question?.id)
      .single();

    expect(fetchResult.data).toMatchObject({
      status: "answered",
      answered_at: "2026-07-04T03:21:03.000Z",
    });
  });

  it("initializes UI preferences before the first read", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ruletrade-sqlite-"));
    tempDirs.push(tempDir);
    process.env.SQLITE_DATABASE_PATH = path.join(tempDir, "test.sqlite");

    const { createSqliteClient } = await import("@/lib/db/sqlite-client");
    const result = await createSqliteClient()
      .from("user_ui_preferences")
      .select("ai_provider, ai_model")
      .eq("user_id", "user-1")
      .maybeSingle();

    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  it("初期DBにA〜Dの主要テーブルをまとめて作成する", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ruletrade-sqlite-"));
    tempDirs.push(tempDir);
    process.env.SQLITE_DATABASE_PATH = path.join(tempDir, "test.sqlite");

    const { createSqliteClient, getSqliteDatabase } = await import(
      "@/lib/db/sqlite-client"
    );
    await createSqliteClient().from("holistic_reviews").select("id").limit(1);
    const tables = getSqliteDatabase()
      .prepare(
        "select name from sqlite_master where type = 'table' and name in ('price_quotes', 'fx_rates', 'rule_alert_events', 'portfolio_targets', 'news_items', 'drift_alert_events', 'holistic_reviews')",
      )
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables.sort()).toEqual([
      "drift_alert_events",
      "fx_rates",
      "holistic_reviews",
      "news_items",
      "portfolio_targets",
      "price_quotes",
      "rule_alert_events",
    ]);
  });

  it("既存price_quotesのticker列を保持しつつsymbolへ移行する", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ruletrade-sqlite-"));
    tempDirs.push(tempDir);
    const databasePath = path.join(tempDir, "legacy.sqlite");
    const Database = (await import("better-sqlite3")).default;
    const legacyDb = new Database(databasePath);
    legacyDb.exec(`
      create table price_quotes (
        id text primary key,
        ticker text not null,
        quote_date text not null,
        close_price real not null,
        currency text not null default 'JPY',
        unique (ticker, quote_date)
      )
    `);
    legacyDb
      .prepare(
        "insert into price_quotes (id, ticker, quote_date, close_price) values (?, ?, ?, ?)",
      )
      .run("quote-1", "7203", "2026-07-16", 3000);

    const { initializeSqliteSchema } = await import("@/lib/db/sqlite-schema");
    initializeSqliteSchema(legacyDb);
    const columns = legacyDb
      .prepare("pragma table_info(price_quotes)")
      .all() as Array<{ name: string }>;
    const row = legacyDb
      .prepare("select ticker, symbol, source, market from price_quotes where id = ?")
      .get("quote-1") as {
      ticker: string;
      symbol: string;
      source: string;
      market: string;
    };

    expect(columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["ticker", "symbol", "source", "market"]),
    );
    expect(row).toMatchObject({
      ticker: "7203",
      symbol: "7203",
      source: "mock",
      market: "JP",
    });
    expect(
      legacyDb
        .prepare(
          "select name from sqlite_master where type = 'table' and name = 'holistic_reviews'",
        )
        .get(),
    ).toEqual({ name: "holistic_reviews" });
    legacyDb.close();
  });
});
