import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

const directory = mkdtempSync(path.join(os.tmpdir(), "ruletrade-cs01-"));
const databasePath = path.join(directory, "legacy.sqlite");
const timestamp = "2026-02-13T15:00:00.000Z";

function createLegacyDatabase() {
  const legacy = new Database(databasePath);
  legacy.exec(`
    CREATE TABLE stocks(id TEXT PRIMARY KEY, ticker TEXT, name TEXT NOT NULL, normalized_name TEXT NOT NULL, market TEXT, created_at TEXT NOT NULL);
    INSERT INTO stocks VALUES ('stock-1','7203','架空旧社','架空旧社','JP','${timestamp}');
    INSERT INTO stocks VALUES ('stock-2','AAPL','架空米社','架空米社','US','${timestamp}');
  `);
  legacy.close();
}

let database: typeof import("@/lib/db");
let schema: typeof import("@/lib/db/schema");
let actions: typeof import("@/features/stocks/actions");
let exportRoute: typeof import("@/app/api/export/route");
let importRoute: typeof import("@/app/api/import/json/route");

beforeAll(async () => {
  createLegacyDatabase();
  process.env.RULETRADE_DATABASE_PATH = databasePath;
  database = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  actions = await import("@/features/stocks/actions");
  exportRoute = await import("@/app/api/export/route");
  importRoute = await import("@/app/api/import/json/route");
});

afterAll(() => {
  database.getDb().$client.close();
  rmSync(directory, { recursive: true, force: true });
});

it("migrates existing stocks to unclassified and creates the change history", () => {
  const client = database.getDb().$client;
  expect(
    client
      .prepare("SELECT id, bucket FROM stocks ORDER BY id")
      .all(),
  ).toEqual([
    { id: "stock-1", bucket: "unclassified" },
    { id: "stock-2", bucket: "unclassified" },
  ]);
  expect(
    client
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'stock_bucket_changes'",
      )
      .get(),
  ).toEqual({ name: "stock_bucket_changes" });
  expect(client.pragma("foreign_key_check")).toEqual([]);
});

it("records one history row per change and skips no-op changes", async () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime("2026-03-01T00:00:00.000Z");
    expect(
      await actions.changeStockBucketAction({
        stockId: "stock-1",
        bucket: "core",
        reason: " 買う前にコアと決めていた ",
      }),
    ).toEqual({ ok: true, changed: true, bucket: "core" });
    expect(
      await actions.changeStockBucketAction({
        stockId: "stock-1",
        bucket: "core",
      }),
    ).toEqual({ ok: true, changed: false, bucket: "core" });
    vi.setSystemTime("2026-03-02T00:00:00.000Z");
    expect(
      await actions.changeStockBucketAction({
        stockId: "stock-1",
        bucket: "satellite",
        reason: "",
      }),
    ).toEqual({ ok: true, changed: true, bucket: "satellite" });
  } finally {
    vi.useRealTimers();
  }

  expect(
    database
      .getDb()
      .select()
      .from(schema.stocks)
      .all()
      .find((stock) => stock.id === "stock-1")?.bucket,
  ).toBe("satellite");
  expect(await actions.listStockBucketHistoryAction("stock-1")).toEqual([
    {
      id: expect.any(String),
      stockId: "stock-1",
      fromBucket: "unclassified",
      toBucket: "core",
      reason: "買う前にコアと決めていた",
      changedAt: "2026-03-01T00:00:00.000Z",
    },
    {
      id: expect.any(String),
      stockId: "stock-1",
      fromBucket: "core",
      toBucket: "satellite",
      reason: null,
      changedAt: "2026-03-02T00:00:00.000Z",
    },
  ]);
});

it("round-trips buckets and their history through JSON export and import", async () => {
  const exported = await (await exportRoute.GET()).json();
  expect(exported.formatVersion).toBe(4);
  expect(exported.stocks).toMatchObject([
    { id: "stock-1", bucket: "satellite" },
    { id: "stock-2", bucket: "unclassified" },
  ]);
  expect(exported.stockBucketChanges).toHaveLength(2);

  const client = database.getDb().$client;
  client.exec("DELETE FROM stock_bucket_changes; DELETE FROM stocks;");
  const response = await importRoute.POST(
    new Request("http://localhost/api/import/json", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(exported),
    }),
  );
  expect(response.status).toBe(200);
  const restored = await (await exportRoute.GET()).json();
  expect(restored.stocks).toEqual(exported.stocks);
  expect(restored.stockBucketChanges).toEqual(exported.stockBucketChanges);
});

it("treats a backup without bucket data as unclassified", async () => {
  const exported = await (await exportRoute.GET()).json();
  const legacy = structuredClone(exported) as Record<string, unknown>;
  legacy.formatVersion = 3;
  delete legacy.stockBucketChanges;
  for (const stock of legacy.stocks as Array<Record<string, unknown>>)
    delete stock.bucket;
  const client = database.getDb().$client;
  client.exec("DELETE FROM stock_bucket_changes; DELETE FROM stocks;");
  const response = await importRoute.POST(
    new Request("http://localhost/api/import/json", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(legacy),
    }),
  );
  expect(response.status).toBe(200);
  const restored = await (await exportRoute.GET()).json();
  expect(restored.stocks).toMatchObject([
    { id: "stock-1", bucket: "unclassified" },
    { id: "stock-2", bucket: "unclassified" },
  ]);
  expect(restored.stockBucketChanges).toEqual([]);
});
