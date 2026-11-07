import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";

const directory = mkdtempSync(
  path.join(os.tmpdir(), "ruletrade-r02-migration-"),
);
const databasePath = path.join(directory, "legacy.sqlite");
const timestamp = "2026-02-13T15:00:00.000Z";

function createLegacyDatabase() {
  const legacy = new Database(databasePath);
  legacy.exec(`
    CREATE TABLE stocks(id TEXT PRIMARY KEY, ticker TEXT, name TEXT NOT NULL, normalized_name TEXT NOT NULL, market TEXT, created_at TEXT NOT NULL);
    CREATE TABLE decisions(id TEXT PRIMARY KEY, stock_id TEXT NOT NULL REFERENCES stocks(id), type TEXT NOT NULL, raw_input TEXT NOT NULL, transcript TEXT, follow_up_answer TEXT, thesis TEXT, assumptions_json TEXT NOT NULL, review_conditions_json TEXT NOT NULL, add_conditions_json TEXT NOT NULL, review_at TEXT, created_at TEXT NOT NULL);
    CREATE TABLE reviews(id TEXT PRIMARY KEY, stock_id TEXT NOT NULL REFERENCES stocks(id), decision_id TEXT REFERENCES decisions(id), current_input TEXT NOT NULL, summary TEXT NOT NULL, differences_json TEXT NOT NULL, reflection TEXT NOT NULL, created_at TEXT NOT NULL);
    INSERT INTO stocks VALUES ('stock',NULL,'架空旧社','架空旧社',NULL,'${timestamp}');
    INSERT INTO decisions VALUES ('decision','stock','note','旧記録',NULL,NULL,NULL,'[]','[]','[]','2026-03-01T12:00:00.000Z','${timestamp}');
    INSERT INTO reviews VALUES ('review','stock','decision','当時の考え','比較','[]','振り返り','${timestamp}');
  `);
  legacy.close();
}

it("migrates a legacy database to origins, captures and idempotency keys without losing rows", async () => {
  createLegacyDatabase();
  process.env.RULETRADE_DATABASE_PATH = databasePath;
  try {
    const { getDb } = await import("@/lib/db");
    const first = getDb();
    const client = first.$client;

    expect(client.pragma("table_info(decisions)")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "origin",
          notnull: 1,
          dflt_value: "'web'",
        }),
      ]),
    );
    expect(client.pragma("table_info(reviews)")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "origin",
          notnull: 1,
          dflt_value: "'web'",
        }),
      ]),
    );
    expect(client.pragma("table_info(captures)")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "stock_id" }),
        expect.objectContaining({ name: "stock_hint" }),
        expect.objectContaining({ name: "raw_input", notnull: 1 }),
        expect.objectContaining({
          name: "origin",
          notnull: 1,
          dflt_value: "'web'",
        }),
        expect.objectContaining({
          name: "status",
          notnull: 1,
          dflt_value: "'pending'",
        }),
        expect.objectContaining({ name: "decision_id" }),
        expect.objectContaining({ name: "created_at", notnull: 1 }),
        expect.objectContaining({ name: "organized_at" }),
      ]),
    );
    expect(client.pragma("table_info(integration_requests)")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "client_request_id",
          pk: 1,
          notnull: 1,
        }),
        expect.objectContaining({ name: "endpoint", notnull: 1 }),
        expect.objectContaining({ name: "request_hash", notnull: 1 }),
        expect.objectContaining({ name: "resource_type", notnull: 1 }),
        expect.objectContaining({ name: "resource_id", notnull: 1 }),
        expect.objectContaining({ name: "created_at", notnull: 1 }),
      ]),
    );
    expect(
      client
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'captures_status_idx'",
        )
        .get(),
    ).toEqual({ name: "captures_status_idx" });
    expect(client.prepare("SELECT origin FROM decisions").all()).toEqual([
      { origin: "web" },
    ]);
    expect(client.prepare("SELECT origin FROM reviews").all()).toEqual([
      { origin: "web" },
    ]);

    const actions = await import("@/features/decisions/actions");
    const timeline = await actions.getStockTimelineAction({ stockId: "stock" });
    expect(timeline.decisions[0]).toMatchObject({
      id: "decision",
      origin: "web",
      rawInput: "旧記録",
    });
    expect(
      await actions.listReviewsForStockAction({ stockId: "stock" }),
    ).toMatchObject([{ id: "review", origin: "web" }]);

    client
      .prepare(
        "INSERT INTO captures (id, stock_id, raw_input, created_at) VALUES (?, ?, ?, ?)",
      )
      .run("capture", "stock", "原文", timestamp);
    expect(
      client
        .prepare(
          "SELECT stock_hint, origin, status, decision_id, organized_at FROM captures WHERE id = 'capture'",
        )
        .get(),
    ).toEqual({
      stock_hint: null,
      origin: "web",
      status: "pending",
      decision_id: null,
      organized_at: null,
    });
    client
      .prepare("INSERT INTO integration_requests VALUES (?, ?, ?, ?, ?, ?)")
      .run("key", "POST /decisions", "hash", "decision", "decision", timestamp);
    expect(
      client
        .prepare("SELECT count(*) AS count FROM integration_requests")
        .get(),
    ).toEqual({ count: 1 });
    expect(client.pragma("foreign_key_check")).toEqual([]);
    first.$client.close();

    // A second process start must not re-add columns or tables.
    vi.resetModules();
    const { getDb: getDbAgain } = await import("@/lib/db");
    const second = getDbAgain();
    expect(
      second.$client.prepare("SELECT count(*) AS count FROM decisions").get(),
    ).toEqual({ count: 1 });
    expect(
      second.$client.prepare("SELECT count(*) AS count FROM reviews").get(),
    ).toEqual({ count: 1 });
    expect(
      second.$client.prepare("SELECT origin FROM decisions").get(),
    ).toEqual({ origin: "web" });
    expect(
      second.$client.prepare("SELECT count(*) AS count FROM captures").get(),
    ).toEqual({ count: 1 });
    expect(
      second.$client
        .pragma("table_info(decisions)")
        .filter(({ name }: { name: string }) => name === "origin"),
    ).toHaveLength(1);
    expect(second.$client.pragma("foreign_key_check")).toEqual([]);
    second.$client.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
