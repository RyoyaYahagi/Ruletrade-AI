import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("price quote service", () => {
  const originalEnv = { ...process.env };
  const tempDirs: string[] = [];

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    for (const tempDir of tempDirs.splice(0)) fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("upserts the same symbol/date without duplicating rows", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ruletrade-prices-"));
    tempDirs.push(tempDir);
    process.env.SQLITE_DATABASE_PATH = path.join(tempDir, "test.sqlite");
    const { saveDailyQuotes } = await import("@/lib/prices/price-quote-service");
    const quote = {
      symbol: "7203",
      market: "JP",
      quoteDate: "2026-07-16",
      closePrice: 3050,
      currency: "JPY",
    };

    await saveDailyQuotes([quote]);
    await saveDailyQuotes([{ ...quote, closePrice: 3060 }]);

    const { getSqliteDatabase } = await import("@/lib/db/sqlite-client");
    const row = getSqliteDatabase()
      .prepare("select count(*) as count, close_price as closePrice from price_quotes where symbol = '7203'")
      .get() as { count: number; closePrice: number };
    expect(row).toEqual({ count: 1, closePrice: 3060 });
  });

  it("returns null for a missing quote and marks a four-day-old quote stale", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ruletrade-prices-"));
    tempDirs.push(tempDir);
    process.env.SQLITE_DATABASE_PATH = path.join(tempDir, "test.sqlite");
    const { getLatestQuote, saveDailyQuotes } = await import("@/lib/prices/price-quote-service");
    await expect(getLatestQuote({ symbol: "NONE", market: "JP" })).resolves.toEqual({ quote: null, isStale: false });

    const oldDate = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await saveDailyQuotes([{ symbol: "7203", market: "JP", quoteDate: oldDate, closePrice: 3000, currency: "JPY" }]);
    await expect(getLatestQuote({ symbol: "7203", market: "JP" })).resolves.toMatchObject({ isStale: true });
  });
});
