import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";

const directory = mkdtempSync(path.join(os.tmpdir(), "ruletrade-cs02-"));
process.env.RULETRADE_DATABASE_PATH = path.join(directory, "journal.sqlite");
process.env.RULETRADE_E2E_DISABLE_MARKET_QUOTES = "1";

let database: typeof import("@/lib/db");
let schema: typeof import("@/lib/db/schema");
let bucketData: typeof import("@/features/portfolio/bucket-data");

beforeAll(async () => {
  database = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  bucketData = await import("@/features/portfolio/bucket-data");
});

afterAll(() => {
  delete process.env.RULETRADE_E2E_DISABLE_MARKET_QUOTES;
  database.getDb().$client.close();
  rmSync(directory, { recursive: true, force: true });
});

it("aggregates gross invested amounts and current holdings from the database", async () => {
  const db = database.getDb();
  db.insert(schema.stocks)
    .values({
      id: "stock-sat",
      ticker: "7203",
      name: "検証社",
      normalizedName: "検証社",
      market: "JP",
      marketCode: "JP",
      bucket: "satellite",
      createdAt: "2026-01-01T00:00:00.000Z",
    })
    .run();
  db.insert(schema.transactions)
    .values([
      {
        id: "buy",
        stockId: "stock-sat",
        side: "buy",
        quantity: 10,
        price: 1000,
        fee: null,
        executedAt: "2026-01-02T00:00:00.000Z",
        decisionId: null,
        createdAt: "2026-01-02T00:00:00.000Z",
        priceCurrency: "JPY",
      },
      {
        id: "sell",
        stockId: "stock-sat",
        side: "sell",
        quantity: 5,
        price: 1200,
        fee: null,
        executedAt: "2026-01-03T00:00:00.000Z",
        decisionId: null,
        createdAt: "2026-01-03T00:00:00.000Z",
        priceCurrency: "JPY",
      },
    ])
    .run();

  const summary = await bucketData.loadBucketSummary();

  expect(summary.buckets.satellite.investedJpy).toBe(10000);
  expect(summary.buckets.satellite.marketValueJpy).toBe(5000);
  expect(summary.satelliteInvestedPct).toBe(100);
  expect(summary.substitutedStockIds).toEqual(["stock-sat"]);
  expect(summary.rateUnavailable).toBe(false);
  expect(summary.exchangeRate).toBeNull();
});
