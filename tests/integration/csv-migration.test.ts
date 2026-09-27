import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";

it("adds import metadata to an existing database without altering journal records", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "ruletrade-migration-"));
  const databasePath = path.join(directory, "legacy.sqlite");
  const legacy = new Database(databasePath);
  legacy.exec(`
    CREATE TABLE stocks(id TEXT PRIMARY KEY, ticker TEXT, name TEXT NOT NULL, normalized_name TEXT NOT NULL, market TEXT, created_at TEXT NOT NULL);
    CREATE TABLE transactions(id TEXT PRIMARY KEY, stock_id TEXT NOT NULL REFERENCES stocks(id), side TEXT NOT NULL, quantity REAL NOT NULL, price REAL, fee REAL, executed_at TEXT NOT NULL, decision_id TEXT, created_at TEXT NOT NULL);
    INSERT INTO stocks VALUES ('legacy-stock','1234','架空既存企業','架空既存企業','JP','2026-01-01T12:00:00.000Z');
    INSERT INTO transactions VALUES ('legacy-trade','legacy-stock','buy',10,NULL,NULL,'2026-01-01T12:00:00.000Z',NULL,'2026-01-01T12:00:00.000Z');
  `);
  legacy.close();
  process.env.RULETRADE_DATABASE_PATH = databasePath;
  const { getDb } = await import("@/lib/db");
  const {
    stocks,
    transactions,
    importBatches,
    transactionImportSources,
    importChanges,
  } = await import("@/lib/db/schema");
  const db = getDb();
  try {
    expect(db.select().from(stocks).all()).toMatchObject([
      { id: "legacy-stock", ticker: "1234", market: "JP", marketCode: null },
    ]);
    expect(db.select().from(transactions).all()).toMatchObject([
      {
        id: "legacy-trade",
        quantity: 10,
        price: null,
        decisionId: null,
        importBatchId: null,
        sourceFingerprint: null,
        priceCurrency: null,
      },
    ]);
    expect(db.select().from(importBatches).all()).toEqual([]);
    expect(db.select().from(transactionImportSources).all()).toEqual([]);
    expect(db.select().from(importChanges).all()).toEqual([]);
    expect(db.$client.pragma("table_info(import_batches)")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "merged_count", dflt_value: "0" }),
      ]),
    );
    expect(db.$client.pragma("foreign_key_check")).toEqual([]);
  } finally {
    db.$client.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
