import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import packageJson from "../../../package.json";
import type { MarketQuote } from "@/features/market-data/provider";

const directory = mkdtempSync(
  path.join(os.tmpdir(), "ruletrade-integration-read-"),
);
process.env.RULETRADE_DATABASE_PATH = path.join(directory, "journal.sqlite");

const market = vi.hoisted(() => ({ getQuotes: vi.fn() }));
vi.mock("@/features/market-data/provider", () => ({
  yahooMarketPriceProvider: { getQuotes: market.getQuotes },
}));

const READ_TOKEN = "test-read-token";
const WRITE_TOKEN = "test-write-token";

const STOCK_A = {
  id: "stock-test-shoji",
  ticker: "9999",
  name: "テスト商事",
  normalizedName: "テスト商事",
  market: "JP",
  marketCode: "JP",
  createdAt: "2026-01-02T03:04:05.000Z",
};
const STOCK_B = {
  id: "stock-apple-test",
  ticker: "TEST",
  name: "Apple Test",
  normalizedName: "apple test",
  market: "US",
  marketCode: "US",
  createdAt: "2026-02-03T04:05:06.000Z",
};
const STOCK_C = {
  id: "stock-test-denki",
  ticker: "8888",
  name: "テスト電機",
  normalizedName: "テスト電機",
  market: "JP",
  marketCode: "JP",
  createdAt: "2026-03-04T05:06:07.000Z",
};
const STOCK_D = {
  id: "stock-unheld",
  ticker: null,
  name: "未保有テスト",
  normalizedName: "未保有テスト",
  market: null,
  marketCode: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const DECISION_A1 = {
  id: "decision-a1",
  stockId: STOCK_A.id,
  type: "buy",
  rawInput: "AI向け需要に期待して購入した。",
  transcript: null,
  followUpAnswer: "次の決算を見る。",
  followUpQuestion: "需要を何で確認しますか？",
  summary: null,
  points: JSON.stringify([
    { kind: "reason", text: "需要が伸びている", source: "raw_input" },
  ]),
  thesis: "AI向け需要の継続",
  assumptions: JSON.stringify(["データセンター需要が続く"]),
  reviewConditions: JSON.stringify(["NAND価格が下落する"]),
  addConditions: JSON.stringify(["在庫回転が改善する"]),
  reviewAt: "2026-12-07T12:00:00.000Z",
  reviewDates: JSON.stringify(["2026-12-07T12:00:00.000Z"]),
  decidedAt: "2026-11-07",
  createdAt: "2026-11-07T12:45:00.000Z",
};
const DECISION_A2 = {
  id: "decision-a2",
  stockId: STOCK_A.id,
  type: "note",
  rawInput: "様子を見る。",
  transcript: null,
  followUpAnswer: null,
  followUpQuestion: null,
  summary: "様子を見る。",
  points: JSON.stringify([]),
  thesis: null,
  assumptions: JSON.stringify([]),
  reviewConditions: JSON.stringify([]),
  addConditions: JSON.stringify([]),
  reviewAt: null,
  reviewDates: null,
  decidedAt: null,
  createdAt: "2026-11-08T01:00:00.000Z",
};
const DECISION_B1 = {
  id: "decision-b1",
  stockId: STOCK_B.id,
  type: "note",
  rawInput: "Apple Test のメモ。",
  transcript: null,
  followUpAnswer: null,
  followUpQuestion: null,
  summary: "Apple Test のメモ。",
  points: JSON.stringify([]),
  thesis: null,
  assumptions: JSON.stringify([]),
  reviewConditions: JSON.stringify([]),
  addConditions: JSON.stringify([]),
  reviewAt: null,
  reviewDates: null,
  decidedAt: "2026-10-15",
  createdAt: "2026-10-15T02:00:00.000Z",
};

const TRANSACTION_A_BUY = {
  id: "transaction-a-buy",
  stockId: STOCK_A.id,
  side: "buy",
  quantity: 100,
  price: 2500,
  fee: 550,
  executedAt: "2026-11-07T12:00:00.000Z",
  decisionId: DECISION_A1.id,
  createdAt: "2026-11-07T12:05:00.000Z",
  priceCurrency: "JPY",
  feeCurrency: "JPY",
  settlementDate: "2026-11-11T12:00:00.000Z",
  settlementCurrency: "JPY",
  settlementAmount: 250550,
  exchangeRate: null,
  accountType: "特定",
  sourceBroker: "sbi",
  sourceTradeType: "現物買",
};
const TRANSACTION_A_SELL = {
  id: "transaction-a-sell",
  stockId: STOCK_A.id,
  side: "sell",
  quantity: 20,
  price: 2800,
  fee: null,
  executedAt: "2026-11-07T13:00:00.000Z",
  decisionId: null,
  createdAt: "2026-11-07T13:05:00.000Z",
  priceCurrency: "JPY",
  feeCurrency: null,
  settlementDate: null,
  settlementCurrency: null,
  settlementAmount: null,
  exchangeRate: null,
  accountType: "特定",
  sourceBroker: "sbi",
  sourceTradeType: "現物売",
};
const TRANSACTION_B_BUY = {
  id: "transaction-b-buy",
  stockId: STOCK_B.id,
  side: "buy",
  quantity: 10,
  price: 150,
  fee: null,
  // 2026-11-06 00:00 JST.
  executedAt: "2026-11-05T15:00:00.000Z",
  decisionId: null,
  createdAt: "2026-11-05T15:05:00.000Z",
  priceCurrency: "USD",
  feeCurrency: null,
  settlementDate: null,
  settlementCurrency: null,
  settlementAmount: null,
  exchangeRate: null,
  accountType: null,
  sourceBroker: null,
  sourceTradeType: null,
};
const TRANSACTION_C_BUY = {
  id: "transaction-c-buy",
  stockId: STOCK_C.id,
  side: "buy",
  quantity: 100,
  price: 8000,
  fee: null,
  executedAt: "2026-10-01T00:00:00.000Z",
  decisionId: null,
  createdAt: "2026-10-01T00:05:00.000Z",
  priceCurrency: "JPY",
  feeCurrency: null,
  settlementDate: null,
  settlementCurrency: null,
  settlementAmount: null,
  exchangeRate: null,
  accountType: null,
  sourceBroker: null,
  sourceTradeType: null,
};

const REVIEW_A = {
  id: "review-a",
  stockId: STOCK_A.id,
  decisionId: DECISION_A1.id,
  currentInput: "需要は続いている。",
  summary: "見方は変わっていない。",
  differences: JSON.stringify(["在庫の見方だけ変わった"]),
  reflection: "在庫を確認する頻度を上げる。",
  createdAt: "2026-11-08T08:09:10.000Z",
};

let dbModule: typeof import("@/lib/db");
let schema: typeof import("@/lib/db/schema");
let portfolioActions: typeof import("@/features/portfolio/actions");
let valuation: typeof import("@/features/portfolio/valuation");
let routes: {
  status: typeof import("@/app/api/integration/v1/status/route");
  holdings: typeof import("@/app/api/integration/v1/holdings/route");
  stocks: typeof import("@/app/api/integration/v1/stocks/route");
  stock: typeof import("@/app/api/integration/v1/stocks/[id]/route");
  transactions: typeof import("@/app/api/integration/v1/transactions/route");
  notFound: typeof import("@/app/api/integration/v1/[[...path]]/route");
};

beforeAll(async () => {
  process.env.RULETRADE_READ_TOKEN = READ_TOKEN;
  process.env.RULETRADE_WRITE_TOKEN = WRITE_TOKEN;
  dbModule = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  portfolioActions = await import("@/features/portfolio/actions");
  valuation = await import("@/features/portfolio/valuation");
  routes = {
    status: await import("@/app/api/integration/v1/status/route"),
    holdings: await import("@/app/api/integration/v1/holdings/route"),
    stocks: await import("@/app/api/integration/v1/stocks/route"),
    stock: await import("@/app/api/integration/v1/stocks/[id]/route"),
    transactions: await import("@/app/api/integration/v1/transactions/route"),
    notFound: await import("@/app/api/integration/v1/[[...path]]/route"),
  };
});

beforeEach(() => {
  const db = dbModule.getDb();
  db.delete(schema.reviews).run();
  db.delete(schema.transactions).run();
  db.delete(schema.decisions).run();
  db.delete(schema.stocks).run();
  seedDatabase(db);
  market.getQuotes.mockReset();
  market.getQuotes.mockResolvedValue(defaultQuotes());
});

afterAll(() => {
  dbModule.getDb().$client.close();
  rmSync(directory, { recursive: true, force: true });
});

function seedDatabase(db: ReturnType<typeof dbModule.getDb>) {
  db.insert(schema.stocks).values([STOCK_A, STOCK_B, STOCK_C, STOCK_D]).run();
  db.insert(schema.decisions)
    .values([DECISION_A1, DECISION_A2, DECISION_B1])
    .run();
  db.insert(schema.transactions)
    .values([
      TRANSACTION_A_BUY,
      TRANSACTION_A_SELL,
      TRANSACTION_B_BUY,
      TRANSACTION_C_BUY,
    ])
    .run();
  db.insert(schema.reviews).values([REVIEW_A]).run();
}

function marketQuote(
  symbol: string,
  price: number,
  currency: "JPY" | "USD",
): MarketQuote {
  return {
    symbol,
    price,
    currency,
    priceAt: "2026-11-07T06:30:00.000Z",
    marketState: "REGULAR",
    delayedByMinutes: 20,
    sourceName: "Yahoo Finance",
  };
}

function defaultQuotes(): Map<string, MarketQuote> {
  return new Map([
    ["9999.T", marketQuote("9999.T", 2800, "JPY")],
    ["TEST", marketQuote("TEST", 165, "USD")],
    ["8888.T", marketQuote("8888.T", 8500, "JPY")],
  ]);
}

function apiRequest(
  pathname: string,
  token: string | null = READ_TOKEN,
  method = "GET",
): Request {
  const headers = new Headers();
  if (token !== null) headers.set("authorization", `Bearer ${token}`);
  return new Request(`http://localhost/api/integration/v1${pathname}`, {
    method,
    headers,
  });
}

function stockContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function readData(response: Response): Promise<Record<string, unknown>> {
  const body = (await response.json()) as {
    generatedAt?: string;
    data?: Record<string, unknown>;
  };
  expect(body.data).toBeDefined();
  expect(typeof body.generatedAt).toBe("string");
  return body.data!;
}

describe("authentication", () => {
  it("returns 404 when the read token is unset, regardless of the header", async () => {
    const original = process.env.RULETRADE_READ_TOKEN;
    delete process.env.RULETRADE_READ_TOKEN;
    try {
      for (const request of [
        apiRequest("/status", null),
        apiRequest("/status", READ_TOKEN),
      ]) {
        const response = await routes.status.GET(request);
        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({
          error: {
            code: "not_found",
            message: "リソースが見つかりません。",
          },
        });
      }
    } finally {
      if (original === undefined) delete process.env.RULETRADE_READ_TOKEN;
      else process.env.RULETRADE_READ_TOKEN = original;
    }
  });

  it("returns 401 for missing, wrong, and write-scope tokens", async () => {
    for (const token of [null, "wrong-token", WRITE_TOKEN]) {
      const response = await routes.status.GET(apiRequest("/status", token));
      expect(response.status).toBe(401);
      expect(response.headers.get("www-authenticate")).toBe("Bearer");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toEqual({
        error: {
          code: "unauthorized",
          message: "認証に失敗しました。",
        },
      });
    }
  });

  it("accepts the read token with a case-insensitive Bearer scheme", async () => {
    const request = apiRequest("/status", null);
    request.headers.set("authorization", `bearer ${READ_TOKEN}`);
    const response = await routes.status.GET(request);
    expect(response.status).toBe(200);
  });

  it("checks the scope before the method and authentication before 405", async () => {
    const original = process.env.RULETRADE_READ_TOKEN;
    delete process.env.RULETRADE_READ_TOKEN;
    try {
      expect(
        (await routes.status.POST(apiRequest("/status", READ_TOKEN))).status,
      ).toBe(404);
    } finally {
      if (original === undefined) delete process.env.RULETRADE_READ_TOKEN;
      else process.env.RULETRADE_READ_TOKEN = original;
    }

    expect((await routes.status.POST(apiRequest("/status", null))).status).toBe(
      401,
    );

    for (const method of [
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
      "HEAD",
    ] as const) {
      const response = await routes.status[method](
        apiRequest("/status", READ_TOKEN),
      );
      expect(response.status).toBe(405);
      expect(await response.json()).toEqual({
        error: {
          code: "method_not_allowed",
          message: "このメソッドは許可されていません。",
        },
      });
    }
  });
});

describe("common response shape", () => {
  it("adds generatedAt and the common headers to every read endpoint", async () => {
    const responses = [
      await routes.status.GET(apiRequest("/status")),
      await routes.holdings.GET(apiRequest("/holdings")),
      await routes.stocks.GET(apiRequest("/stocks")),
      await routes.stock.GET(
        apiRequest(`/stocks/${STOCK_A.id}`),
        stockContext(STOCK_A.id),
      ),
      await routes.transactions.GET(apiRequest("/transactions")),
    ];

    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("content-type")).toBe(
        "application/json; charset=utf-8",
      );
      const body = (await response.json()) as { generatedAt: string };
      expect(new Date(body.generatedAt).toISOString()).toBe(body.generatedAt);
    }
  });

  it("returns the standard 404 body for unknown API paths", async () => {
    for (const method of [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
      "HEAD",
    ] as const) {
      const response = await routes.notFound[method]();
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        error: {
          code: "not_found",
          message: "リソースが見つかりません。",
        },
      });
    }
  });
});

describe("GET /status", () => {
  it("returns fixed counts and latest record timestamps without R-02 fields", async () => {
    const response = await routes.status.GET(apiRequest("/status"));
    expect(response.status).toBe(200);
    const data = await readData(response);

    expect(data).toEqual({
      apiVersion: "v1",
      appVersion: packageJson.version,
      counts: {
        stocks: 4,
        decisions: 3,
        transactions: 4,
        reviews: 1,
      },
      latest: {
        stocks: STOCK_C.createdAt,
        decisions: DECISION_A2.createdAt,
        transactions: TRANSACTION_A_SELL.createdAt,
        reviews: REVIEW_A.createdAt,
      },
    });
    expect(data.counts).not.toHaveProperty("capturesPending");
    expect(data.latest).not.toHaveProperty("captures");
  });
});

describe("GET /holdings", () => {
  it("returns the same quantities, acquisition amounts, and profit/loss as the portfolio screen", async () => {
    const response = await routes.holdings.GET(apiRequest("/holdings"));
    expect(response.status).toBe(200);
    const data = await readData(response);
    const holdings = data.holdings as Array<Record<string, unknown>>;

    expect(market.getQuotes).toHaveBeenCalledWith(
      expect.arrayContaining(["9999.T", "TEST", "8888.T"]),
    );
    expect(holdings.map((holding) => holding.stockId)).toEqual([
      STOCK_B.id,
      STOCK_A.id,
      STOCK_C.id,
    ]);

    const expectedHoldings = await portfolioActions.listPortfolioAction();
    const expectedValued = valuation.calculateValuation(
      expectedHoldings,
      defaultQuotes(),
    );

    for (const expected of expectedValued) {
      const actual = holdings.find(
        (holding) => holding.stockId === expected.holding.stockId,
      );
      expect(actual).toBeDefined();
      expect(actual?.quantity).toBe(expected.holding.quantity);
      expect(actual?.averagePurchasePrice).toEqual(
        expected.holding.averagePurchasePrice === null
          ? null
          : {
              amount: expected.holding.averagePurchasePrice,
              currency: expected.holding.currency,
            },
      );
      expect(actual?.acquisitionAmount).toEqual(
        expected.holding.acquisitionAmount === null
          ? null
          : {
              amount: expected.holding.acquisitionAmount,
              currency: expected.holding.currency,
            },
      );
      expect(actual?.unrealizedProfitLoss).toEqual(
        expected.unrealizedProfitLoss === null
          ? null
          : {
              amount: expected.unrealizedProfitLoss,
              currency: expected.holding.currency,
            },
      );
      expect(actual?.marketValue).toEqual(
        expected.marketValue === null
          ? null
          : {
              amount: expected.marketValue,
              currency: expected.quote?.currency,
            },
      );
    }

    const toyota = holdings.find((holding) => holding.stockId === STOCK_A.id);
    expect(toyota).toMatchObject({
      stockName: STOCK_A.name,
      quantity: 80,
      averagePurchasePrice: { amount: 2500, currency: "JPY" },
      acquisitionAmount: { amount: 200000, currency: "JPY" },
      quote: {
        price: { amount: 2800, currency: "JPY" },
        priceAt: "2026-11-07T06:30:00.000Z",
        marketState: "REGULAR",
        delayedByMinutes: 20,
        sourceName: "Yahoo Finance",
      },
      quoteError: null,
      marketValue: { amount: 224000, currency: "JPY" },
      unrealizedProfitLoss: { amount: 24000, currency: "JPY" },
      unrealizedProfitLossRate: 12,
      realizedProfitLoss: null,
    });

    const totals = data.totalsByCurrency as Array<Record<string, unknown>>;
    expect(totals.map((total) => total.currency)).toEqual(["JPY", "USD"]);
    expect(data).not.toHaveProperty("total");
    expect(totals[0]).toEqual({
      currency: "JPY",
      marketValue: { amount: 1074000, currency: "JPY" },
      acquisitionAmount: { amount: 1000000, currency: "JPY" },
      unrealizedProfitLoss: { amount: 74000, currency: "JPY" },
      unrealizedProfitLossRate: (74000 / 1000000) * 100,
      realizedProfitLoss: null,
      completeness: {
        marketValue: true,
        acquisitionAmount: true,
        profitLoss: true,
        allocation: true,
      },
    });
    expect(totals[1]).toEqual({
      currency: "USD",
      marketValue: { amount: 1650, currency: "USD" },
      acquisitionAmount: { amount: 1500, currency: "USD" },
      unrealizedProfitLoss: { amount: 150, currency: "USD" },
      unrealizedProfitLossRate: 10,
      realizedProfitLoss: null,
      completeness: {
        marketValue: true,
        acquisitionAmount: true,
        profitLoss: true,
        allocation: true,
      },
    });

    for (const total of totals) {
      for (const key of [
        "marketValue",
        "acquisitionAmount",
        "unrealizedProfitLoss",
        "realizedProfitLoss",
      ]) {
        const money = total[key] as { currency: string } | null;
        if (money !== null) {
          expect(money.currency).toBe(total.currency);
        }
      }
    }
  });

  it("returns holdings with quote: null and quoteError when a quote is missing", async () => {
    const quotes = defaultQuotes();
    quotes.delete("8888.T");
    market.getQuotes.mockResolvedValue(quotes);

    const response = await routes.holdings.GET(apiRequest("/holdings"));
    expect(response.status).toBe(200);
    const data = await readData(response);
    const holdings = data.holdings as Array<Record<string, unknown>>;

    const nintendo = holdings.find((holding) => holding.stockId === STOCK_C.id);
    expect(nintendo).toMatchObject({
      quote: null,
      quoteError: "市場価格を取得できませんでした",
      marketValue: null,
      unrealizedProfitLoss: null,
      unrealizedProfitLossRate: null,
      realizedProfitLoss: null,
    });

    const totals = data.totalsByCurrency as Array<Record<string, unknown>>;
    const jpy = totals.find((total) => total.currency === "JPY");
    expect(jpy).toMatchObject({
      marketValue: null,
      acquisitionAmount: { amount: 1000000, currency: "JPY" },
      unrealizedProfitLoss: null,
      unrealizedProfitLossRate: null,
      completeness: {
        marketValue: false,
        acquisitionAmount: true,
        profitLoss: false,
        allocation: false,
      },
    });
  });

  it("still returns holdings when the quote provider fails", async () => {
    market.getQuotes.mockRejectedValue(new Error("provider unavailable"));

    const response = await routes.holdings.GET(apiRequest("/holdings"));
    expect(response.status).toBe(200);
    const data = await readData(response);
    const holdings = data.holdings as Array<Record<string, unknown>>;

    expect(holdings).toHaveLength(3);
    expect(holdings.every((holding) => holding.quote === null)).toBe(true);
    expect(
      holdings.find((holding) => holding.stockId === STOCK_A.id),
    ).toMatchObject({
      quantity: 80,
      acquisitionAmount: { amount: 200000, currency: "JPY" },
      quoteError: "市場価格を取得できませんでした",
    });
  });
});

describe("GET /stocks", () => {
  it("returns every stock with held state, decision count, and last decision day", async () => {
    const response = await routes.stocks.GET(apiRequest("/stocks"));
    expect(response.status).toBe(200);
    const data = await readData(response);
    const stocks = data.stocks as Array<Record<string, unknown>>;

    expect(stocks.map((stock) => stock.id)).toEqual([
      STOCK_B.id,
      STOCK_A.id,
      STOCK_C.id,
      STOCK_D.id,
    ]);
    const byId = new Map(stocks.map((stock) => [stock.id, stock]));

    expect(byId.get(STOCK_A.id)).toMatchObject({
      id: STOCK_A.id,
      ticker: "9999",
      name: STOCK_A.name,
      market: "JP",
      marketCode: "JP",
      createdAt: STOCK_A.createdAt,
      isHeld: true,
      decisionCount: 2,
      lastDecidedOn: "2026-11-08",
    });
    expect(byId.get(STOCK_B.id)).toMatchObject({
      isHeld: true,
      decisionCount: 1,
      lastDecidedOn: "2026-10-15",
    });
    expect(byId.get(STOCK_C.id)).toMatchObject({
      isHeld: true,
      decisionCount: 0,
      lastDecidedOn: null,
    });
    expect(byId.get(STOCK_D.id)).toMatchObject({
      market: null,
      marketCode: null,
      isHeld: false,
      decisionCount: 0,
      lastDecidedOn: null,
    });
  });
});

describe("GET /stocks/:id", () => {
  it("returns the stock, holding, counts, and a stably sorted timeline", async () => {
    const response = await routes.stock.GET(
      apiRequest(`/stocks/${STOCK_A.id}`),
      stockContext(STOCK_A.id),
    );
    expect(response.status).toBe(200);
    const data = await readData(response);

    expect(data.stock).toEqual({
      id: STOCK_A.id,
      ticker: "9999",
      name: STOCK_A.name,
      market: "JP",
      marketCode: "JP",
      createdAt: STOCK_A.createdAt,
    });
    expect(data.holding).toMatchObject({
      stockId: STOCK_A.id,
      stockName: STOCK_A.name,
      quantity: 80,
      averagePurchasePrice: { amount: 2500, currency: "JPY" },
      acquisitionAmount: { amount: 200000, currency: "JPY" },
      currency: "JPY",
      hasWarning: false,
      warningReason: null,
      adjustments: [],
    });
    expect(data.counts).toEqual({
      decisions: 2,
      transactions: 2,
      reviews: 1,
    });

    const timeline = data.timeline as Array<Record<string, unknown>>;
    expect(
      timeline.map(
        (item) => `${item.kind}:${item.occurredOn}:${item.occurredAt}`,
      ),
    ).toEqual([
      "transaction:2026-11-07:2026-11-07T12:00:00.000Z",
      "decision:2026-11-07:2026-11-07T12:45:00.000Z",
      "transaction:2026-11-07:2026-11-07T13:00:00.000Z",
      "decision:2026-11-08:2026-11-08T01:00:00.000Z",
      "review:2026-11-08:2026-11-08T08:09:10.000Z",
    ]);

    for (const item of timeline) {
      const payloads = ["decision", "transaction", "review"].filter(
        (key) => key in item,
      );
      expect(payloads).toEqual([item.kind]);
    }

    const decisionA1 = timeline[1].decision as Record<string, unknown>;
    expect(decisionA1).toMatchObject({
      id: DECISION_A1.id,
      type: "buy",
      summary: "AI向け需要の継続",
      points: [
        { kind: "reason", text: "需要が伸びている", source: "raw_input" },
      ],
      assumptions: ["データセンター需要が続く"],
      reviewConditions: ["NAND価格が下落する"],
      addConditions: ["在庫回転が改善する"],
      reviewAt: "2026-12-07T12:00:00.000Z",
      reviewDates: ["2026-12-07T12:00:00.000Z"],
      decidedAt: "2026-11-07",
      createdAt: "2026-11-07T12:45:00.000Z",
    });
    expect(decisionA1).not.toHaveProperty("origin");
    expect(decisionA1).not.toHaveProperty("editHistory");

    const decisionA2 = timeline[3].decision as Record<string, unknown>;
    expect(decisionA2).toMatchObject({
      summary: "様子を見る。",
      decidedAt: null,
      reviewDates: [],
    });

    const transactionBuy = timeline[0].transaction as Record<string, unknown>;
    expect(transactionBuy).toMatchObject({
      id: TRANSACTION_A_BUY.id,
      price: { amount: 2500, currency: "JPY" },
      fee: { amount: 550, currency: "JPY" },
      settlement: {
        date: "2026-11-11T12:00:00.000Z",
        amount: { amount: 250550, currency: "JPY" },
        exchangeRate: null,
      },
      accountType: "特定",
      sourceBroker: "sbi",
      sourceTradeType: "現物買",
    });

    const review = timeline[4].review as Record<string, unknown>;
    expect(review).toMatchObject({
      id: REVIEW_A.id,
      decisionId: DECISION_A1.id,
      currentInput: REVIEW_A.currentInput,
      summary: REVIEW_A.summary,
      differences: ["在庫の見方だけ変わった"],
      reflection: REVIEW_A.reflection,
    });
    expect(review).not.toHaveProperty("origin");
  });

  it("returns 404 for an unknown stock", async () => {
    const response = await routes.stock.GET(
      apiRequest("/stocks/missing"),
      stockContext("missing"),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "not_found",
        message: "リソースが見つかりません。",
      },
    });
  });
});

describe("GET /transactions", () => {
  it("returns the transaction shape with Money, settlement, and stable ordering", async () => {
    const response = await routes.transactions.GET(apiRequest("/transactions"));
    expect(response.status).toBe(200);
    const data = await readData(response);
    const transactions = data.transactions as Array<Record<string, unknown>>;

    expect(transactions.map((transaction) => transaction.id)).toEqual([
      TRANSACTION_A_SELL.id,
      TRANSACTION_A_BUY.id,
      TRANSACTION_B_BUY.id,
      TRANSACTION_C_BUY.id,
    ]);
    expect(transactions[0]).toEqual({
      id: TRANSACTION_A_SELL.id,
      stockId: STOCK_A.id,
      side: "sell",
      quantity: 20,
      price: { amount: 2800, currency: "JPY" },
      fee: null,
      executedAt: "2026-11-07T13:00:00.000Z",
      decisionId: null,
      createdAt: "2026-11-07T13:05:00.000Z",
      settlement: null,
      accountType: "特定",
      sourceBroker: "sbi",
      sourceTradeType: "現物売",
    });
    expect(transactions[1]).toMatchObject({
      id: TRANSACTION_A_BUY.id,
      decisionId: DECISION_A1.id,
      settlement: {
        date: "2026-11-11T12:00:00.000Z",
        amount: { amount: 250550, currency: "JPY" },
        exchangeRate: null,
      },
    });
    expect(transactions[1]).not.toHaveProperty("priceCurrency");
    expect(transactions[1]).not.toHaveProperty("importBatchId");

    const apple = transactions.find(
      (transaction) => transaction.id === TRANSACTION_B_BUY.id,
    );
    expect(apple).toMatchObject({
      price: { amount: 150, currency: "USD" },
      fee: null,
      settlement: null,
      accountType: null,
      sourceBroker: null,
      sourceTradeType: null,
    });
  });

  it("filters by stock, side, and JST execution date and ignores unknown parameters", async () => {
    const cases: Array<[string, string[]]> = [
      [
        "?side=buy",
        [TRANSACTION_A_BUY.id, TRANSACTION_B_BUY.id, TRANSACTION_C_BUY.id],
      ],
      [`?stockId=${STOCK_A.id}`, [TRANSACTION_A_SELL.id, TRANSACTION_A_BUY.id]],
      [
        "?from=2026-11-07&to=2026-11-07",
        [TRANSACTION_A_SELL.id, TRANSACTION_A_BUY.id],
      ],
      ["?from=2026-11-06&to=2026-11-06", [TRANSACTION_B_BUY.id]],
      ["?from=2026-10-01&to=2026-10-01", [TRANSACTION_C_BUY.id]],
      [
        "?from=2026-11-06",
        [TRANSACTION_A_SELL.id, TRANSACTION_A_BUY.id, TRANSACTION_B_BUY.id],
      ],
      [
        "?unknown=value",
        [
          TRANSACTION_A_SELL.id,
          TRANSACTION_A_BUY.id,
          TRANSACTION_B_BUY.id,
          TRANSACTION_C_BUY.id,
        ],
      ],
    ];

    for (const [query, expectedIds] of cases) {
      const response = await routes.transactions.GET(
        apiRequest(`/transactions${query}`),
      );
      expect(response.status).toBe(200);
      const data = await readData(response);
      expect(
        (data.transactions as Array<{ id: string }>).map(
          (transaction) => transaction.id,
        ),
      ).toEqual(expectedIds);
    }
  });

  it("rejects invalid queries with 400 and an error-only body", async () => {
    for (const query of [
      "?side=hold",
      "?from=2026-02-30",
      "?to=2026-13-01",
      "?from=2026-11-08&to=2026-11-07",
    ]) {
      const response = await routes.transactions.GET(
        apiRequest(`/transactions${query}`),
      );
      expect(response.status).toBe(400);
      const body = (await response.json()) as {
        generatedAt?: string;
        error?: { code: string };
      };
      expect(body.error?.code).toBe("validation_error");
      expect(body).not.toHaveProperty("generatedAt");
    }
  });

  it("returns 404 for an unknown stockId filter", async () => {
    const response = await routes.transactions.GET(
      apiRequest("/transactions?stockId=missing"),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "not_found",
        message: "リソースが見つかりません。",
      },
    });
  });
});
