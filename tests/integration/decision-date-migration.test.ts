import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { japanDate } from "@/features/transactions/matching";

it("adds decided_at to a legacy database and preserves created_at as the display fallback", async () => {
  const directory = mkdtempSync(
    path.join(os.tmpdir(), "ruletrade-date-migration-"),
  );
  const databasePath = path.join(directory, "legacy.sqlite");
  const legacy = new Database(databasePath);
  legacy.exec(`
    CREATE TABLE stocks(id TEXT PRIMARY KEY, ticker TEXT, name TEXT NOT NULL, normalized_name TEXT NOT NULL, market TEXT, created_at TEXT NOT NULL);
    CREATE TABLE decisions(id TEXT PRIMARY KEY, stock_id TEXT NOT NULL REFERENCES stocks(id), type TEXT NOT NULL, raw_input TEXT NOT NULL, transcript TEXT, follow_up_answer TEXT, thesis TEXT, assumptions_json TEXT NOT NULL, review_conditions_json TEXT NOT NULL, add_conditions_json TEXT NOT NULL, review_at TEXT, created_at TEXT NOT NULL);
    INSERT INTO stocks VALUES ('stock',NULL,'架空旧社','架空旧社',NULL,'2026-02-13T15:00:00.000Z');
    INSERT INTO decisions VALUES ('decision','stock','note','旧記録',NULL,NULL,NULL,'[]','[]','[]',NULL,'2026-02-13T15:00:00.000Z');
  `);
  legacy.close();
  process.env.RULETRADE_DATABASE_PATH = databasePath;
  const { getDb } = await import("@/lib/db");
  const { getStockTimelineAction } =
    await import("@/features/decisions/actions");
  try {
    const timeline = await getStockTimelineAction({ stockId: "stock" });
    const decision = timeline.decisions[0];
    expect(decision.decidedAt).toBeNull();
    expect(decision.rawInput).toBe("旧記録");
    expect(decision.createdAt).toBe("2026-02-13T15:00:00.000Z");
    expect(japanDate(decision.decidedAt ?? decision.createdAt)).toBe(
      "2026-02-14",
    );
    expect(getDb().$client.pragma("foreign_key_check")).toEqual([]);
  } finally {
    getDb().$client.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
