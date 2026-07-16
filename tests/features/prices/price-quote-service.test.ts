import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

describe("price quote service", () => {
  const originalEnv = { ...process.env };
  const tempDirs: string[] = [];

  afterEach(() => {
    process.env = originalEnv;
    vi.useRealTimers();
    vi.resetModules();
    for (const tempDir of tempDirs.splice(0)) {
      fs.rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("saves and reads the latest quote without duplicate rows", async () => {
    const { service, client } = await loadService();
    const quote = {
      symbol: "7203",
      market: "JP",
      quoteDate: "2026-07-16",
      closePrice: 3050,
      currency: "JPY",
    };

    await service.saveDailyQuotes([quote]);
    await service.saveDailyQuotes([quote]);

    const latest = await service.getLatestQuote({
      symbol: "7203",
      market: "JP",
    });
    const rows = await client
      .from("price_quotes")
      .select("*")
      .eq("symbol", "7203")
      .eq("market", "JP");

    expect(latest).toEqual({ quote, isStale: false });
    expect(rows.data).toHaveLength(1);
  });

  it("marks quotes at least four calendar days old as stale", async () => {
    const { service } = await loadService();
    vi.setSystemTime(new Date("2026-07-16T12:00:00.000Z"));

    await service.saveDailyQuotes([
      {
        symbol: "AAPL",
        market: "US",
        quoteDate: "2026-07-12",
        closePrice: 200,
        currency: "USD",
      },
    ]);

    const latest = await service.getLatestQuote({
      symbol: "AAPL",
      market: "US",
    });
    expect(latest.isStale).toBe(true);
  });

  it("returns no quote without throwing", async () => {
    const { service } = await loadService();

    await expect(
      service.getLatestQuote({ symbol: "MISSING", market: "JP" }),
    ).resolves.toEqual({ quote: null, isStale: false });
  });

  async function loadService() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ruletrade-prices-"));
    tempDirs.push(tempDir);
    process.env.SQLITE_DATABASE_PATH = path.join(tempDir, "test.sqlite");

    const service = await import("@/lib/prices/price-quote-service");
    const { createSqliteClient } = await import("@/lib/db/sqlite-client");
    return { service, client: createSqliteClient() };
  }
});
