import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const directory = mkdtempSync(
  path.join(os.tmpdir(), "ruletrade-integration-due-"),
);
process.env.RULETRADE_DATABASE_PATH = path.join(directory, "journal.sqlite");

const READ_TOKEN = "test-read-token";
const WRITE_TOKEN = "test-write-token";

const STOCK_A = {
  id: "stock-due-a",
  ticker: "285A",
  name: "期限確認社",
  normalizedName: "期限確認社",
  market: "JP",
  marketCode: "JP",
  createdAt: "2026-01-02T03:04:05.000Z",
};
const STOCK_B = {
  id: "stock-due-b",
  ticker: "9999",
  name: "理由なし社",
  normalizedName: "理由なし社",
  market: "JP",
  marketCode: "JP",
  createdAt: "2026-01-03T03:04:05.000Z",
};

function decisionRow(overrides: {
  id: string;
  stockId: string;
  reviewAt: string | null;
  reviewDates: string[] | null;
  origin?: "web" | "muse";
  createdAt?: string;
}) {
  return {
    id: overrides.id,
    stockId: overrides.stockId,
    type: "note",
    rawInput: "架空の判断メモ",
    transcript: null,
    followUpAnswer: null,
    followUpQuestion: null,
    summary: "架空の判断メモ",
    points: JSON.stringify([]),
    thesis: null,
    assumptions: JSON.stringify([]),
    reviewConditions: JSON.stringify([]),
    addConditions: JSON.stringify([]),
    reviewAt: overrides.reviewAt,
    reviewDates:
      overrides.reviewDates === null
        ? null
        : JSON.stringify(overrides.reviewDates),
    editHistory: JSON.stringify([]),
    decidedAt: "2026-01-01",
    createdAt: overrides.createdAt ?? "2026-01-01T10:00:00.000Z",
    origin: overrides.origin ?? "web",
  };
}

const DECISION_NEXT = decisionRow({
  id: "decision-next",
  stockId: STOCK_A.id,
  reviewAt: "2026-01-10T12:00:00.000Z",
  reviewDates: ["2026-01-10T12:00:00.000Z", "2026-02-10T12:00:00.000Z"],
  origin: "muse",
});
const DECISION_EARLY = decisionRow({
  id: "decision-early",
  stockId: STOCK_B.id,
  reviewAt: "2026-02-01T12:00:00.000Z",
  reviewDates: ["2026-02-01T12:00:00.000Z"],
});
const DECISION_FUTURE = decisionRow({
  id: "decision-future",
  stockId: STOCK_B.id,
  reviewAt: "2026-03-01T12:00:00.000Z",
  reviewDates: ["2026-03-01T12:00:00.000Z"],
});
const DECISION_REVIEWED = decisionRow({
  id: "decision-reviewed",
  stockId: STOCK_B.id,
  reviewAt: "2026-01-01T12:00:00.000Z",
  reviewDates: ["2026-01-01T12:00:00.000Z"],
});
const DECISION_NO_SCHEDULE = decisionRow({
  id: "decision-no-schedule",
  stockId: STOCK_B.id,
  reviewAt: null,
  reviewDates: null,
});

function transactionRow(
  id: string,
  executedAt: string,
  decisionId: string | null,
) {
  return {
    id,
    stockId: STOCK_B.id,
    side: "buy" as const,
    quantity: 10,
    price: 1000,
    fee: null,
    executedAt,
    decisionId,
    createdAt: executedAt,
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
}

const TRANSACTIONS = [
  transactionRow("transaction-1", "2026-02-01T12:00:00.000Z", null),
  transactionRow("transaction-2", "2026-02-02T12:00:00.000Z", null),
  transactionRow("transaction-3", "2026-02-03T12:00:00.000Z", null),
  transactionRow("transaction-4", "2026-02-04T12:00:00.000Z", null),
  transactionRow(
    "transaction-linked",
    "2026-02-05T12:00:00.000Z",
    DECISION_EARLY.id,
  ),
];

const REVIEW_CLEARS = {
  id: "review-clears",
  stockId: STOCK_B.id,
  decisionId: DECISION_REVIEWED.id,
  currentInput: "一度振り返った",
  summary: "振り返りの要約",
  differences: JSON.stringify([]),
  reflection: "振り返りの本文",
  createdAt: "2026-01-15T00:00:00.000Z",
  origin: "web",
};
const REVIEW_NEXT = {
  id: "review-next",
  stockId: STOCK_A.id,
  decisionId: DECISION_NEXT.id,
  currentInput: "1回目の振り返り",
  summary: "振り返りの要約",
  differences: JSON.stringify([]),
  reflection: "振り返りの本文",
  createdAt: "2026-01-20T00:00:00.000Z",
  origin: "web",
};

let dbModule: typeof import("@/lib/db");
let schema: typeof import("@/lib/db/schema");
let dueFeature: typeof import("@/features/due/due");
let route: typeof import("@/app/api/integration/v1/due/route");

beforeAll(async () => {
  process.env.RULETRADE_READ_TOKEN = READ_TOKEN;
  process.env.RULETRADE_WRITE_TOKEN = WRITE_TOKEN;
  dbModule = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  dueFeature = await import("@/features/due/due");
  route = await import("@/app/api/integration/v1/due/route");
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime("2026-02-10T13:00:00.000Z");
  const db = dbModule.getDb();
  db.delete(schema.captures).run();
  db.delete(schema.reviews).run();
  db.delete(schema.transactions).run();
  db.delete(schema.decisions).run();
  db.delete(schema.stocks).run();
  db.insert(schema.stocks).values([STOCK_A, STOCK_B]).run();
  db.insert(schema.decisions)
    .values([
      DECISION_NEXT,
      DECISION_EARLY,
      DECISION_FUTURE,
      DECISION_REVIEWED,
      DECISION_NO_SCHEDULE,
    ])
    .run();
  db.insert(schema.transactions).values(TRANSACTIONS).run();
  db.insert(schema.reviews).values([REVIEW_CLEARS, REVIEW_NEXT]).run();
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(() => {
  dbModule.getDb().$client.close();
  rmSync(directory, { recursive: true, force: true });
});

function apiRequest(token: string | null = READ_TOKEN, method = "GET") {
  const headers = new Headers();
  if (token !== null) headers.set("authorization", `Bearer ${token}`);
  return new Request("http://localhost/api/integration/v1/due", {
    method,
    headers,
  });
}

type DueBody = {
  generatedAt: string;
  data: {
    asOf: string;
    dueDecisions: Array<{
      stock: { id: string; marketCode: string | null };
      decision: {
        id: string;
        reviewAt: string | null;
        origin: string;
      };
      dueReviewAt: string;
      dueOn: string;
    }>;
    unlinkedTransactions: Array<{
      stock: { id: string };
      transaction: { id: string; decisionId: string | null };
    }>;
  };
};

async function readBody(response: Response): Promise<DueBody> {
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  return (await response.json()) as DueBody;
}

describe("GET /api/integration/v1/due", () => {
  it("returns the shared rule's due decisions with the original reviewAt", async () => {
    const body = await readBody(await route.GET(apiRequest()));

    expect(body.data.asOf).toBe("2026-02-10T13:00:00.000Z");
    expect(body.data.dueDecisions.map(({ decision }) => decision.id)).toEqual([
      DECISION_EARLY.id,
      DECISION_NEXT.id,
    ]);
    expect(
      body.data.dueDecisions.map(({ dueReviewAt }) => dueReviewAt),
    ).toEqual(["2026-02-01T12:00:00.000Z", "2026-02-10T12:00:00.000Z"]);
    expect(body.data.dueDecisions.map(({ dueOn }) => dueOn)).toEqual([
      "2026-02-01",
      "2026-02-10",
    ]);
    expect(body.data.dueDecisions[1]).toMatchObject({
      stock: { id: STOCK_A.id, marketCode: "JP" },
      decision: {
        id: DECISION_NEXT.id,
        reviewAt: "2026-01-10T12:00:00.000Z",
        origin: "muse",
      },
      dueReviewAt: "2026-02-10T12:00:00.000Z",
    });
  });

  it("returns every unlinked transaction, newest first, including more than three", async () => {
    const body = await readBody(await route.GET(apiRequest()));

    expect(
      body.data.unlinkedTransactions.map(({ transaction }) => transaction.id),
    ).toEqual([
      "transaction-4",
      "transaction-3",
      "transaction-2",
      "transaction-1",
    ]);
    expect(
      body.data.unlinkedTransactions.every(
        ({ transaction }) => transaction.decisionId === null,
      ),
    ).toBe(true);
    expect(body.data.unlinkedTransactions[0].stock.id).toBe(STOCK_B.id);
  });

  it("matches the shared function for the same asOf", async () => {
    vi.setSystemTime("2026-02-10T13:00:00.000Z");
    const shared = await dueFeature.listDueDecisions(
      "2026-02-10T13:00:00.000Z",
    );
    const body = await readBody(await route.GET(apiRequest()));

    expect(
      body.data.dueDecisions.map(({ decision, dueReviewAt, dueOn }) => ({
        id: decision.id,
        reviewAt: decision.reviewAt,
        dueReviewAt,
        dueOn,
      })),
    ).toEqual(
      shared.map(({ decision, dueReviewAt, dueOn }) => ({
        id: decision.id,
        reviewAt: decision.reviewAt,
        dueReviewAt,
        dueOn,
      })),
    );
  });

  it("returns 404 when the read token is unset", async () => {
    const original = process.env.RULETRADE_READ_TOKEN;
    delete process.env.RULETRADE_READ_TOKEN;
    try {
      const response = await route.GET(apiRequest(READ_TOKEN));
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        error: { code: "not_found", message: "リソースが見つかりません。" },
      });
    } finally {
      if (original === undefined) delete process.env.RULETRADE_READ_TOKEN;
      else process.env.RULETRADE_READ_TOKEN = original;
    }
  });

  it("returns 401 for missing, wrong, and write-scope tokens", async () => {
    for (const token of [null, "wrong-token", WRITE_TOKEN]) {
      const response = await route.GET(apiRequest(token));
      expect(response.status).toBe(401);
      expect(response.headers.get("www-authenticate")).toBe("Bearer");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toEqual({
        error: { code: "unauthorized", message: "認証に失敗しました。" },
      });
    }
  });

  it("accepts a case-insensitive Bearer scheme", async () => {
    const request = apiRequest(null);
    request.headers.set("authorization", `bearer ${READ_TOKEN}`);
    expect((await route.GET(request)).status).toBe(200);
  });

  it("authenticates before returning 405 for unsupported methods", async () => {
    expect((await route.POST(apiRequest(null))).status).toBe(401);
    for (const method of [
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
      "HEAD",
    ] as const) {
      const response = await route[method](apiRequest());
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
