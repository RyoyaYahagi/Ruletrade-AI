import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { japanDate } from "@/features/transactions/matching";

const directory = mkdtempSync(
  path.join(os.tmpdir(), "ruletrade-integration-write-"),
);
process.env.RULETRADE_DATABASE_PATH = path.join(directory, "journal.sqlite");

const READ_TOKEN = "write-test-read-token";
const WRITE_TOKEN = "write-test-write-token";

const STOCK_A = {
  id: "stock-write-a",
  ticker: "1111",
  name: "書き込みテスト社",
  normalizedName: "書き込みテスト社",
  market: "JP",
  marketCode: "JP",
  createdAt: "2026-01-02T03:04:05.000Z",
};
const STOCK_B = {
  id: "stock-write-b",
  ticker: "2222",
  name: "別銘柄テスト社",
  normalizedName: "別銘柄テスト社",
  market: "JP",
  marketCode: "JP",
  createdAt: "2026-01-03T03:04:05.000Z",
};

const DECISION_A = {
  id: "decision-write-a",
  stockId: STOCK_A.id,
  type: "buy",
  rawInput: "既存の判断A。",
  transcript: null,
  followUpAnswer: null,
  followUpQuestion: null,
  summary: "既存の判断A。",
  points: "[]",
  thesis: null,
  assumptions: "[]",
  reviewConditions: "[]",
  addConditions: "[]",
  reviewAt: null,
  reviewDates: "[]",
  decidedAt: "2026-11-01",
  createdAt: "2026-11-01T01:00:00.000Z",
  origin: "web",
};
const DECISION_A2 = {
  ...DECISION_A,
  id: "decision-write-a2",
  rawInput: "既存の判断A2。",
  summary: "既存の判断A2。",
  createdAt: "2026-11-02T01:00:00.000Z",
};
const DECISION_B = {
  ...DECISION_A,
  id: "decision-write-b",
  stockId: STOCK_B.id,
  rawInput: "既存の判断B。",
  summary: "既存の判断B。",
};

const TRANSACTION_A = {
  id: "transaction-write-a",
  stockId: STOCK_A.id,
  side: "buy",
  quantity: 100,
  price: 2500,
  fee: 550,
  executedAt: "2026-11-07T12:00:00.000Z",
  decisionId: null,
  createdAt: "2026-11-07T12:05:00.000Z",
  priceCurrency: "JPY",
  feeCurrency: "JPY",
};
const TRANSACTION_B = {
  ...TRANSACTION_A,
  id: "transaction-write-b",
  stockId: STOCK_B.id,
};

let dbModule: typeof import("@/lib/db");
let schema: typeof import("@/lib/db/schema");
let routes: {
  decisions: typeof import("@/app/api/integration/v1/decisions/route");
  decisionLink: typeof import("@/app/api/integration/v1/transactions/[id]/decision-link/route");
  reviews: typeof import("@/app/api/integration/v1/reviews/route");
  captures: typeof import("@/app/api/integration/v1/captures/route");
};

beforeAll(async () => {
  process.env.RULETRADE_READ_TOKEN = READ_TOKEN;
  process.env.RULETRADE_WRITE_TOKEN = WRITE_TOKEN;
  dbModule = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  routes = {
    decisions: await import("@/app/api/integration/v1/decisions/route"),
    decisionLink:
      await import("@/app/api/integration/v1/transactions/[id]/decision-link/route"),
    reviews: await import("@/app/api/integration/v1/reviews/route"),
    captures: await import("@/app/api/integration/v1/captures/route"),
  };
});

beforeEach(() => {
  const db = dbModule.getDb();
  db.delete(schema.integrationRequests).run();
  db.delete(schema.captures).run();
  db.delete(schema.reviews).run();
  db.delete(schema.transactions).run();
  db.delete(schema.decisions).run();
  db.delete(schema.stocks).run();
  db.insert(schema.stocks).values([STOCK_A, STOCK_B]).run();
  db.insert(schema.decisions)
    .values([DECISION_A, DECISION_A2, DECISION_B])
    .run();
  db.insert(schema.transactions).values([TRANSACTION_A, TRANSACTION_B]).run();
});

afterAll(() => {
  dbModule.getDb().$client.close();
  rmSync(directory, { recursive: true, force: true });
});

function apiRequest(
  pathname: string,
  options: {
    token?: string | null;
    method?: string;
    body?: unknown;
    rawBody?: string;
  } = {},
): Request {
  const { token = READ_TOKEN, method = "GET", body, rawBody } = options;
  const headers = new Headers();
  if (token !== null) headers.set("authorization", `Bearer ${token}`);
  if (body !== undefined || rawBody !== undefined) {
    headers.set("content-type", "application/json");
  }
  return new Request(`http://localhost/api/integration/v1${pathname}`, {
    method,
    headers,
    body:
      rawBody !== undefined
        ? rawBody
        : body !== undefined
          ? JSON.stringify(body)
          : undefined,
  });
}

function decisionRequest(
  body: unknown,
  token: string | null = WRITE_TOKEN,
): Promise<Response> {
  return routes.decisions.POST(
    apiRequest("/decisions", { token, method: "POST", body }),
  );
}

function linkRequest(
  transactionId: string,
  body: unknown,
  token: string | null = WRITE_TOKEN,
): Promise<Response> {
  return routes.decisionLink.POST(
    apiRequest(`/transactions/${transactionId}/decision-link`, {
      token,
      method: "POST",
      body,
    }),
    { params: Promise.resolve({ id: transactionId }) },
  );
}

function reviewRequest(
  body: unknown,
  token: string | null = WRITE_TOKEN,
): Promise<Response> {
  return routes.reviews.POST(
    apiRequest("/reviews", { token, method: "POST", body }),
  );
}

function validDecisionBody(overrides: Record<string, unknown> = {}) {
  return {
    clientRequestId: randomUUID(),
    stockId: STOCK_A.id,
    type: "buy",
    rawInput: "APIから保存する判断。",
    ...overrides,
  };
}

function validLinkBody(overrides: Record<string, unknown> = {}) {
  return {
    clientRequestId: randomUUID(),
    decisionId: DECISION_A.id,
    ...overrides,
  };
}

function validReviewBody(overrides: Record<string, unknown> = {}) {
  return {
    clientRequestId: randomUUID(),
    stockId: STOCK_A.id,
    decisionId: DECISION_A.id,
    currentInput: "いまの考え。",
    summary: "前回との違い。",
    differences: ["在庫の見方"],
    reflection: "自分の振り返り。",
    ...overrides,
  };
}

async function readData(response: Response): Promise<Record<string, unknown>> {
  const body = (await response.json()) as {
    generatedAt?: string;
    data?: Record<string, unknown>;
  };
  expect(typeof body.generatedAt).toBe("string");
  expect(body.data).toBeDefined();
  return body.data!;
}

async function readError(response: Response): Promise<string> {
  const body = (await response.json()) as { error: { code: string } };
  return body.error.code;
}

function counts() {
  const db = dbModule.getDb();
  return {
    decisions: db.select().from(schema.decisions).all().length,
    reviews: db.select().from(schema.reviews).all().length,
    captures: db.select().from(schema.captures).all().length,
    requests: db.select().from(schema.integrationRequests).all().length,
  };
}

describe("authentication and methods", () => {
  it("returns 401 for missing, wrong, and read tokens on every write endpoint", async () => {
    for (const token of [null, "wrong-token", READ_TOKEN]) {
      for (const response of [
        await decisionRequest(validDecisionBody(), token),
        await linkRequest(TRANSACTION_A.id, validLinkBody(), token),
        await reviewRequest(validReviewBody(), token),
      ]) {
        expect(response.status).toBe(401);
        expect(response.headers.get("www-authenticate")).toBe("Bearer");
        expect(await readError(response)).toBe("unauthorized");
      }
    }
    expect(counts()).toEqual({
      decisions: 3,
      reviews: 0,
      captures: 0,
      requests: 0,
    });
  });

  it("returns 404 before authentication when the write token is unset", async () => {
    const original = process.env.RULETRADE_WRITE_TOKEN;
    delete process.env.RULETRADE_WRITE_TOKEN;
    try {
      for (const response of [
        await decisionRequest(validDecisionBody(), null),
        await linkRequest(TRANSACTION_A.id, validLinkBody(), WRITE_TOKEN),
        await reviewRequest(validReviewBody(), null),
      ]) {
        expect(response.status).toBe(404);
        expect(await readError(response)).toBe("not_found");
      }
    } finally {
      process.env.RULETRADE_WRITE_TOKEN = original;
    }
  });

  it("checks the write scope before returning 405 for other methods", async () => {
    expect((await routes.decisions.GET(apiRequest("/decisions"))).status).toBe(
      401,
    );
    const response = await routes.decisions.GET(
      apiRequest("/decisions", { token: WRITE_TOKEN }),
    );
    expect(response.status).toBe(405);
    expect(await readError(response)).toBe("method_not_allowed");
  });
});

describe("POST /decisions", () => {
  it("creates a muse decision with defaults and normalized review dates", async () => {
    const rawInput = "  原文の先頭と末尾を残す\n二行目  ";
    const reviewDates = [
      "2026-12-07T12:00:00.000Z",
      "2026-11-07T12:00:00.000Z",
      "2026-12-07T12:00:00.000Z",
    ];
    const before = japanDate(new Date());
    const response = await decisionRequest(
      validDecisionBody({
        type: "thesis_update",
        rawInput,
        thesis: "投資仮説",
        reviewDates,
      }),
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const data = await readData(response);
    expect(data.replayed).toBe(false);
    const decision = data.decision as Record<string, unknown>;
    expect(data.capture).toBeNull();
    expect(decision).toMatchObject({
      stockId: STOCK_A.id,
      type: "thesis_update",
      rawInput,
      summary: "投資仮説",
      thesis: "投資仮説",
      points: [],
      assumptions: [],
      reviewConditions: [],
      addConditions: [],
      reviewAt: "2026-11-07T12:00:00.000Z",
      reviewDates: ["2026-11-07T12:00:00.000Z", "2026-12-07T12:00:00.000Z"],
      decidedAt: before,
      origin: "muse",
    });
    expect(decision.transcript).toBeNull();

    const db = dbModule.getDb();
    expect(db.select().from(schema.decisions).all()).toHaveLength(4);
    expect(db.select().from(schema.transactions).all()).toHaveLength(2);
  });

  it("does not auto-link a same-day transaction", async () => {
    const today = japanDate(new Date());
    const candidateId = "transaction-candidate-today";
    dbModule
      .getDb()
      .insert(schema.transactions)
      .values({
        ...TRANSACTION_A,
        id: candidateId,
        executedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      })
      .run();

    const response = await decisionRequest(
      validDecisionBody({ type: "buy", decidedAt: today }),
    );
    expect(response.status).toBe(201);
    expect(
      dbModule
        .getDb()
        .select()
        .from(schema.transactions)
        .all()
        .find((transaction) => transaction.id === candidateId)?.decisionId,
    ).toBeNull();
  });

  it("organizes a pending capture in the same transaction without changing its text or origin", async () => {
    const capture = {
      id: "capture-pending",
      stockId: null,
      stockHint: "ヒント",
      rawInput: "  受け箱の原文\nそのまま  ",
      origin: "web",
      status: "pending",
      decisionId: null,
      createdAt: "2026-11-07T12:40:00.000Z",
      organizedAt: null,
    };
    dbModule.getDb().insert(schema.captures).values(capture).run();

    const body = validDecisionBody({
      captureId: capture.id,
      rawInput: "判断の原文。",
    });
    const response = await decisionRequest(body);
    expect(response.status).toBe(201);
    const data = await readData(response);
    const decision = data.decision as Record<string, unknown>;
    const returnedCapture = data.capture as Record<string, unknown>;
    expect(returnedCapture).toMatchObject({
      id: capture.id,
      stockId: null,
      stockHint: "ヒント",
      rawInput: capture.rawInput,
      origin: "web",
      status: "organized",
      decisionId: decision.id,
    });
    expect(typeof returnedCapture.organizedAt).toBe("string");

    const stored = dbModule.getDb().select().from(schema.captures).get()!;
    expect(stored).toMatchObject({
      stockId: null,
      rawInput: capture.rawInput,
      origin: "web",
      status: "organized",
      decisionId: decision.id,
    });

    // 受け箱が organized になった後でも、冪等判定は pending チェックより先。
    const replay = await decisionRequest({
      ...body,
      clientRequestId: body.clientRequestId.toUpperCase(),
    });
    expect(replay.status).toBe(200);
    const replayData = await readData(replay);
    expect(replayData.replayed).toBe(true);
    expect((replayData.decision as Record<string, unknown>).id).toBe(
      decision.id,
    );
    expect((replayData.capture as Record<string, unknown>).id).toBe(capture.id);
    expect(counts()).toMatchObject({ decisions: 4, requests: 1 });
  });

  it("replays a decidedAt omission on the next JST day without writing", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-11-07T14:30:00.000Z"));
      const body = validDecisionBody();
      const first = await decisionRequest(body);
      expect(first.status).toBe(201);
      const firstDecision = (await readData(first)).decision as Record<
        string,
        unknown
      >;
      expect(firstDecision.decidedAt).toBe("2026-11-07");

      vi.setSystemTime(new Date("2026-11-08T01:00:00.000Z"));
      const replay = await decisionRequest(body);
      expect(replay.status).toBe(200);
      const replayData = await readData(replay);
      expect(replayData.replayed).toBe(true);
      expect((replayData.decision as Record<string, unknown>).id).toBe(
        firstDecision.id,
      );
      expect((replayData.decision as Record<string, unknown>).decidedAt).toBe(
        "2026-11-07",
      );
      expect(counts()).toMatchObject({ decisions: 4, requests: 1 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns 400 for a capture from another stock without writing", async () => {
    dbModule
      .getDb()
      .insert(schema.captures)
      .values({
        id: "capture-other-stock",
        stockId: STOCK_B.id,
        rawInput: "別銘柄の受け箱。",
        origin: "muse",
        status: "pending",
        createdAt: "2026-11-07T12:40:00.000Z",
      })
      .run();
    const response = await decisionRequest(
      validDecisionBody({ captureId: "capture-other-stock" }),
    );
    expect(response.status).toBe(400);
    expect(await readError(response)).toBe("validation_error");
    expect(counts()).toMatchObject({
      decisions: 3,
      captures: 1,
      requests: 0,
    });
    expect(dbModule.getDb().select().from(schema.captures).get()!.status).toBe(
      "pending",
    );
  });

  it("returns 404 for a missing stock or capture, and 409 for a non-pending capture", async () => {
    const missingStock = await decisionRequest(
      validDecisionBody({ stockId: "missing-stock" }),
    );
    expect(missingStock.status).toBe(404);
    expect(await readError(missingStock)).toBe("not_found");

    const missingCapture = await decisionRequest(
      validDecisionBody({ captureId: "missing-capture" }),
    );
    expect(missingCapture.status).toBe(404);
    expect(await readError(missingCapture)).toBe("not_found");

    dbModule
      .getDb()
      .insert(schema.captures)
      .values({
        id: "capture-organized",
        stockId: STOCK_A.id,
        rawInput: "整理済みの受け箱。",
        origin: "muse",
        status: "organized",
        decisionId: DECISION_A.id,
        createdAt: "2026-11-07T12:40:00.000Z",
        organizedAt: "2026-11-07T12:45:00.000Z",
      })
      .run();
    const notPending = await decisionRequest(
      validDecisionBody({ captureId: "capture-organized" }),
    );
    expect(notPending.status).toBe(409);
    expect(await readError(notPending)).toBe("capture_not_pending");
    expect(counts()).toMatchObject({
      decisions: 3,
      captures: 1,
      requests: 0,
    });
  });

  it("rejects invalid bodies without recording keys", async () => {
    const cases = [
      { ...validDecisionBody(), clientRequestId: "not-a-uuid" },
      { ...validDecisionBody(), rawInput: " \n\t " },
      { ...validDecisionBody(), type: "unknown" },
      { ...validDecisionBody(), decidedAt: "2026-11-07T00:00:00.000Z" },
      { ...validDecisionBody(), reviewDates: ["2026-11-07"] },
      { ...validDecisionBody(), captureId: "" },
      { ...validDecisionBody(), summary: 42 },
    ];
    for (const body of cases) {
      const response = await decisionRequest(body);
      expect(response.status).toBe(400);
      expect(await readError(response)).toBe("validation_error");
    }
    expect(counts()).toMatchObject({ decisions: 3, requests: 0 });
  });

  it("rolls back the decision, capture update, and key when the capture update fails", async () => {
    const db = dbModule.getDb();
    db.insert(schema.captures)
      .values({
        id: "capture-rollback",
        stockId: STOCK_A.id,
        rawInput: "ロールバック対象。",
        origin: "web",
        status: "pending",
        createdAt: "2026-11-07T12:40:00.000Z",
      })
      .run();
    db.$client.exec(`
      CREATE TRIGGER fail_capture_update
      BEFORE UPDATE ON captures
      BEGIN
        SELECT RAISE(ABORT, 'capture update failed');
      END;
    `);
    try {
      const response = await decisionRequest(
        validDecisionBody({ captureId: "capture-rollback" }),
      );
      expect(response.status).toBe(500);
      expect(await readError(response)).toBe("internal_error");
    } finally {
      db.$client.exec("DROP TRIGGER fail_capture_update");
    }

    const capture = db.select().from(schema.captures).get()!;
    expect(capture).toMatchObject({
      status: "pending",
      decisionId: null,
      organizedAt: null,
    });
    expect(counts()).toMatchObject({ decisions: 3, requests: 0 });
  });

  it("rolls back the decision when recording the idempotency key fails", async () => {
    const db = dbModule.getDb();
    db.$client.exec(`
      CREATE TRIGGER fail_request_insert
      BEFORE INSERT ON integration_requests
      BEGIN
        SELECT RAISE(ABORT, 'request insert failed');
      END;
    `);
    try {
      const response = await decisionRequest(validDecisionBody());
      expect(response.status).toBe(500);
      expect(await readError(response)).toBe("internal_error");
    } finally {
      db.$client.exec("DROP TRIGGER fail_request_insert");
    }
    expect(counts()).toMatchObject({ decisions: 3, requests: 0 });
  });
});

describe("POST /transactions/:id/decision-link", () => {
  it("links a decision and reports the previous decision", async () => {
    const first = await linkRequest(TRANSACTION_A.id, validLinkBody());
    expect(first.status).toBe(200);
    const firstData = await readData(first);
    expect(firstData.replayed).toBe(false);
    expect(firstData.previousDecisionId).toBeNull();
    expect((firstData.transaction as Record<string, unknown>).decisionId).toBe(
      DECISION_A.id,
    );
    expect((firstData.decision as Record<string, unknown>).id).toBe(
      DECISION_A.id,
    );

    const replay = await linkRequest(
      TRANSACTION_A.id,
      validLinkBody({
        clientRequestId: randomUUID(),
        decisionId: DECISION_A2.id,
      }),
    );
    expect(replay.status).toBe(200);
    const replayData = await readData(replay);
    expect(replayData.replayed).toBe(false);
    expect(replayData.previousDecisionId).toBe(DECISION_A.id);
    expect((replayData.transaction as Record<string, unknown>).decisionId).toBe(
      DECISION_A2.id,
    );

    const same = await linkRequest(
      TRANSACTION_A.id,
      validLinkBody({
        decisionId: DECISION_A2.id,
      }),
    );
    expect(same.status).toBe(200);
    expect((await readData(same)).previousDecisionId).toBe(DECISION_A2.id);
  });

  it("replays without changes and returns the current state after a Web re-link", async () => {
    const body = validLinkBody({ decisionId: DECISION_A.id });
    const first = await linkRequest(TRANSACTION_A.id, body);
    expect(first.status).toBe(200);

    const db = dbModule.getDb();
    db.update(schema.transactions)
      .set({ decisionId: DECISION_A2.id })
      .where(eq(schema.transactions.id, TRANSACTION_A.id))
      .run();

    const replay = await linkRequest(TRANSACTION_A.id, body);
    expect(replay.status).toBe(200);
    const data = await readData(replay);
    expect(data.replayed).toBe(true);
    expect(data.previousDecisionId).toBeNull();
    expect((data.transaction as Record<string, unknown>).decisionId).toBe(
      DECISION_A2.id,
    );
    expect((data.decision as Record<string, unknown>).id).toBe(DECISION_A2.id);
    expect(
      db
        .select()
        .from(schema.transactions)
        .all()
        .find((transaction) => transaction.id === TRANSACTION_A.id)?.decisionId,
    ).toBe(DECISION_A2.id);
    expect(counts().requests).toBe(1);
  });

  it("does not restore a link removed on the Web when replaying", async () => {
    const body = validLinkBody();
    expect((await linkRequest(TRANSACTION_A.id, body)).status).toBe(200);
    const db = dbModule.getDb();
    db.update(schema.transactions)
      .set({ decisionId: null })
      .where(eq(schema.transactions.id, TRANSACTION_A.id))
      .run();
    const replay = await linkRequest(TRANSACTION_A.id, body);
    expect(replay.status).toBe(200);
    const data = await readData(replay);
    expect(data).toMatchObject({
      replayed: true,
      decision: null,
      previousDecisionId: null,
    });
    expect((data.transaction as Record<string, unknown>).decisionId).toBeNull();
    expect(counts().requests).toBe(1);
  });

  it("does not change the decision origin", async () => {
    const response = await linkRequest(TRANSACTION_A.id, validLinkBody());
    expect(response.status).toBe(200);
    expect(
      dbModule
        .getDb()
        .select()
        .from(schema.decisions)
        .all()
        .find((decision) => decision.id === DECISION_A.id)?.origin,
    ).toBe("web");
  });

  it("returns 400 for a decision of another stock and 404 for missing resources", async () => {
    const mismatch = await linkRequest(
      TRANSACTION_A.id,
      validLinkBody({ decisionId: DECISION_B.id }),
    );
    expect(mismatch.status).toBe(400);
    expect(await readError(mismatch)).toBe("validation_error");

    const missingTransaction = await linkRequest(
      "missing-transaction",
      validLinkBody(),
    );
    expect(missingTransaction.status).toBe(404);

    const missingDecision = await linkRequest(
      TRANSACTION_A.id,
      validLinkBody({ decisionId: "missing-decision" }),
    );
    expect(missingDecision.status).toBe(404);

    expect(counts().requests).toBe(0);
    expect(
      dbModule
        .getDb()
        .select()
        .from(schema.transactions)
        .all()
        .find((transaction) => transaction.id === TRANSACTION_A.id)?.decisionId,
    ).toBeNull();
  });

  it("rejects a null or empty decisionId", async () => {
    for (const decisionId of [null, ""]) {
      const response = await linkRequest(
        TRANSACTION_A.id,
        validLinkBody({ decisionId }),
      );
      expect(response.status).toBe(400);
      expect(await readError(response)).toBe("validation_error");
    }
    expect(counts().requests).toBe(0);
  });
});

describe("POST /reviews", () => {
  it("creates a muse review and trims only the reflection edges", async () => {
    const currentInput = "  いまの考えをそのまま  ";
    const reflection = "  本人の言葉を変えない。\n二行目  ";
    const response = await reviewRequest(
      validReviewBody({
        currentInput,
        summary: "  比較の要約  ",
        differences: ["  差分  "],
        reflection,
      }),
    );
    expect(response.status).toBe(201);
    const data = await readData(response);
    expect(data.replayed).toBe(false);
    expect(data.review).toMatchObject({
      stockId: STOCK_A.id,
      decisionId: DECISION_A.id,
      currentInput,
      summary: "  比較の要約  ",
      differences: ["  差分  "],
      reflection: "本人の言葉を変えない。\n二行目",
      origin: "muse",
    });
    expect((data.decision as Record<string, unknown>).id).toBe(DECISION_A.id);
    expect(counts()).toMatchObject({ reviews: 1, requests: 1 });
  });

  it("accepts an omitted decisionId and replays the current review", async () => {
    const body = validReviewBody({ decisionId: undefined });
    const first = await reviewRequest(body);
    expect(first.status).toBe(201);
    const firstData = await readData(first);
    expect(firstData.decision).toBeNull();
    expect((firstData.review as Record<string, unknown>).decisionId).toBeNull();

    const replay = await reviewRequest(body);
    expect(replay.status).toBe(200);
    const replayData = await readData(replay);
    expect(replayData.replayed).toBe(true);
    expect((replayData.review as Record<string, unknown>).id).toBe(
      (firstData.review as Record<string, unknown>).id,
    );
    expect(counts()).toMatchObject({ reviews: 1, requests: 1 });
  });

  it("treats a whitespace-only change as a different body even though trim saves the same text", async () => {
    const firstBody = validReviewBody({ reflection: "  同じ本文  " });
    expect((await reviewRequest(firstBody)).status).toBe(201);
    const second = await reviewRequest({
      ...firstBody,
      reflection: "   同じ本文  ",
    });
    expect(second.status).toBe(409);
    expect(await readError(second)).toBe("idempotency_key_reused");
    expect(counts()).toMatchObject({ reviews: 1, requests: 1 });
  });

  it("returns 404 for missing stock or decision and 400 for a decision of another stock", async () => {
    for (const body of [
      validReviewBody({ stockId: "missing-stock" }),
      validReviewBody({ decisionId: "missing-decision" }),
    ]) {
      const response = await reviewRequest(body);
      expect(response.status).toBe(404);
      expect(await readError(response)).toBe("not_found");
    }
    const mismatch = await reviewRequest(
      validReviewBody({ decisionId: DECISION_B.id }),
    );
    expect(mismatch.status).toBe(400);
    expect(await readError(mismatch)).toBe("validation_error");
    expect(counts()).toMatchObject({ reviews: 0, requests: 0 });
  });

  it("rejects an empty reflection or missing required fields", async () => {
    for (const body of [
      validReviewBody({ reflection: "   " }),
      validReviewBody({ currentInput: "" }),
      validReviewBody({ summary: "" }),
      validReviewBody({ differences: "not-array" }),
    ]) {
      const response = await reviewRequest(body);
      expect(response.status).toBe(400);
      expect(await readError(response)).toBe("validation_error");
    }
    expect(counts()).toMatchObject({ reviews: 0, requests: 0 });
  });
});

describe("idempotency across endpoints", () => {
  it("returns 409 for the same key used by any other write endpoint", async () => {
    const decisionKey = randomUUID();
    expect(
      (
        await decisionRequest(
          validDecisionBody({ clientRequestId: decisionKey }),
        )
      ).status,
    ).toBe(201);

    for (const response of [
      await reviewRequest(validReviewBody({ clientRequestId: decisionKey })),
      await linkRequest(
        TRANSACTION_A.id,
        validLinkBody({ clientRequestId: decisionKey }),
      ),
      await routes.captures.POST(
        apiRequest("/captures", {
          token: WRITE_TOKEN,
          method: "POST",
          body: {
            clientRequestId: decisionKey,
            rawInput: "別エンドポイント。",
          },
        }),
      ),
    ]) {
      expect(response.status).toBe(409);
      expect(await readError(response)).toBe("idempotency_key_reused");
    }

    const reviewKey = randomUUID();
    expect(
      (await reviewRequest(validReviewBody({ clientRequestId: reviewKey })))
        .status,
    ).toBe(201);
    const reviewConflict = await decisionRequest(
      validDecisionBody({ clientRequestId: reviewKey }),
    );
    expect(reviewConflict.status).toBe(409);

    const linkKey = randomUUID();
    expect(
      (
        await linkRequest(
          TRANSACTION_B.id,
          validLinkBody({
            clientRequestId: linkKey,
            decisionId: DECISION_B.id,
          }),
        )
      ).status,
    ).toBe(200);
    const linkConflict = await routes.captures.POST(
      apiRequest("/captures", {
        token: WRITE_TOKEN,
        method: "POST",
        body: {
          clientRequestId: linkKey,
          rawInput: "リンク済みキー。",
        },
      }),
    );
    expect(linkConflict.status).toBe(409);
    expect(counts()).toMatchObject({
      decisions: 4,
      reviews: 1,
      captures: 0,
      requests: 3,
    });
  });

  it("uses the actual transaction id in the decision-link endpoint identity", async () => {
    const key = randomUUID();
    expect(
      (
        await linkRequest(
          TRANSACTION_A.id,
          validLinkBody({ clientRequestId: key }),
        )
      ).status,
    ).toBe(200);
    const otherTransaction = await linkRequest(
      TRANSACTION_B.id,
      validLinkBody({
        clientRequestId: key,
        decisionId: DECISION_B.id,
      }),
    );
    expect(otherTransaction.status).toBe(409);
    expect(await readError(otherTransaction)).toBe("idempotency_key_reused");
  });

  it("returns 409 for the same key with a different body", async () => {
    const body = validDecisionBody();
    expect((await decisionRequest(body)).status).toBe(201);
    const conflict = await decisionRequest({
      ...body,
      rawInput: "別の本文。",
    });
    expect(conflict.status).toBe(409);
    expect(await readError(conflict)).toBe("idempotency_key_reused");
    expect(counts()).toMatchObject({ decisions: 4, requests: 1 });
  });
});
