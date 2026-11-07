import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";

const directory = mkdtempSync(path.join(os.tmpdir(), "ruletrade-cs06-"));
process.env.RULETRADE_DATABASE_PATH = path.join(directory, "journal.sqlite");
process.env.RULETRADE_E2E_DISABLE_MARKET_QUOTES = "1";
process.env.RULETRADE_READ_TOKEN = "cs06-read-token";

let database: typeof import("@/lib/db");
let schema: typeof import("@/lib/db/schema");
let route: typeof import("@/app/api/integration/v1/due/route");

const STOCK = {
  id: "cs06-stock",
  ticker: "7203",
  name: "警告検証社",
  normalizedName: "警告検証社",
  market: "JP",
  marketCode: "JP",
  bucket: "satellite" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
};
const CORE_STOCK = {
  ...STOCK,
  id: "cs06-core",
  ticker: "1300",
  name: "コア検証社",
  normalizedName: "コア検証社",
  bucket: "core" as const,
};
const TRANSACTION = {
  id: "cs06-buy",
  stockId: STOCK.id,
  side: "buy" as const,
  quantity: 10,
  price: 1000,
  fee: null,
  executedAt: "2026-01-02T00:00:00.000Z",
  decisionId: null,
  createdAt: "2026-01-02T00:00:00.000Z",
  priceCurrency: "JPY" as const,
};
const CORE_TRANSACTION = {
  ...TRANSACTION,
  id: "cs06-core-buy",
  stockId: CORE_STOCK.id,
  quantity: 10,
};

function request() {
  return new Request("http://localhost/api/integration/v1/due", {
    headers: { authorization: `Bearer ${process.env.RULETRADE_READ_TOKEN}` },
  });
}

async function setWarnPct(value: number | null) {
  database
    .getDb()
    .update(schema.appSettings)
    .set({ satelliteWarnPct: value })
    .run();
}

async function readDue() {
  const response = await route.GET(request());
  expect(response.status).toBe(200);
  return (await response.json()) as {
    data: {
      asOf: string;
      dueDecisions: unknown[];
      unlinkedTransactions: Array<{ transaction: { id: string } }>;
      bucketWarning: {
        warnPct: number;
        marketValuePct: number;
        marketValueJpy: number | null;
        message: string;
      } | null;
    };
  };
}

beforeAll(async () => {
  database = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  route = await import("@/app/api/integration/v1/due/route");
});

beforeEach(() => {
  const db = database.getDb();
  db.delete(schema.transactions).run();
  db.delete(schema.decisions).run();
  db.delete(schema.stocks).run();
  db.insert(schema.stocks).values([STOCK, CORE_STOCK]).run();
  db.insert(schema.transactions).values([TRANSACTION, CORE_TRANSACTION]).run();
});

afterAll(() => {
  delete process.env.RULETRADE_E2E_DISABLE_MARKET_QUOTES;
  delete process.env.RULETRADE_READ_TOKEN;
  database.getDb().$client.close();
  rmSync(directory, { recursive: true, force: true });
});

it("adds the warning above the line without changing existing due fields", async () => {
  await setWarnPct(40);
  const { data } = await readDue();

  expect(data.asOf).toEqual(expect.any(String));
  expect(data.dueDecisions).toEqual([]);
  expect(
    data.unlinkedTransactions.map(({ transaction }) => transaction.id),
  ).toEqual([CORE_TRANSACTION.id, TRANSACTION.id]);
  expect(data.bucketWarning).toEqual({
    warnPct: 40,
    marketValuePct: 50,
    marketValueJpy: 10000,
    exchangeRate: null,
    message: "時価ベースのサテライト割合が警告線を超えています。",
  });
});

it("does not warn exactly on the line", async () => {
  await setWarnPct(50);
  expect((await readDue()).data.bucketWarning).toBeNull();
});

it("does not warn below the line", async () => {
  await setWarnPct(60);
  expect((await readDue()).data.bucketWarning).toBeNull();
});

it("does not warn when the line is unset", async () => {
  await setWarnPct(null);
  expect((await readDue()).data.bucketWarning).toBeNull();
});
