import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const directory = mkdtempSync(
  path.join(os.tmpdir(), "ruletrade-integration-captures-"),
);
process.env.RULETRADE_DATABASE_PATH = path.join(directory, "journal.sqlite");

const READ_TOKEN = "capture-read-token";
const WRITE_TOKEN = "capture-write-token";
const STOCK = {
  id: "stock-capture-test",
  ticker: "7777",
  name: "受け箱テスト社",
  normalizedName: "受け箱テスト社",
  market: "JP",
  marketCode: "JP",
  createdAt: "2026-01-02T03:04:05.000Z",
};

let dbModule: typeof import("@/lib/db");
let schema: typeof import("@/lib/db/schema");
let routes: {
  captures: typeof import("@/app/api/integration/v1/captures/route");
};

beforeAll(async () => {
  process.env.RULETRADE_READ_TOKEN = READ_TOKEN;
  process.env.RULETRADE_WRITE_TOKEN = WRITE_TOKEN;
  dbModule = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  routes = {
    captures: await import("@/app/api/integration/v1/captures/route"),
  };
});

beforeEach(() => {
  const db = dbModule.getDb();
  db.delete(schema.integrationRequests).run();
  db.delete(schema.captures).run();
  db.delete(schema.decisions).run();
  db.delete(schema.stocks).run();
  db.insert(schema.stocks).values(STOCK).run();
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

function captureRequest(body: unknown, token: string | null = WRITE_TOKEN) {
  return apiRequest("/captures", { token, method: "POST", body });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    clientRequestId: randomUUID(),
    rawInput: "受け箱の原文。",
    stockId: null,
    stockHint: null,
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

describe("authentication and scope", () => {
  it("returns 404 for an unset token per scope, before checking the header", async () => {
    const originalRead = process.env.RULETRADE_READ_TOKEN;
    const originalWrite = process.env.RULETRADE_WRITE_TOKEN;
    delete process.env.RULETRADE_READ_TOKEN;
    delete process.env.RULETRADE_WRITE_TOKEN;
    try {
      for (const response of [
        await routes.captures.GET(apiRequest("/captures")),
        await routes.captures.GET(apiRequest("/captures", { token: null })),
      ]) {
        expect(response.status).toBe(404);
        expect(await readError(response)).toBe("not_found");
      }

      const write = await routes.captures.POST(captureRequest(validBody()));
      expect(write.status).toBe(404);
      expect(await readError(write)).toBe("not_found");
    } finally {
      if (originalRead === undefined) delete process.env.RULETRADE_READ_TOKEN;
      else process.env.RULETRADE_READ_TOKEN = originalRead;
      if (originalWrite === undefined) delete process.env.RULETRADE_WRITE_TOKEN;
      else process.env.RULETRADE_WRITE_TOKEN = originalWrite;
    }
  });

  it("returns 401 for missing, wrong, and other-scope tokens", async () => {
    for (const token of [null, "wrong-token", WRITE_TOKEN]) {
      const response = await routes.captures.GET(
        apiRequest("/captures", { token }),
      );
      expect(response.status).toBe(401);
      expect(response.headers.get("www-authenticate")).toBe("Bearer");
      expect(await readError(response)).toBe("unauthorized");
    }
    for (const token of [null, "wrong-token", READ_TOKEN]) {
      const response = await routes.captures.POST(
        captureRequest(validBody(), token),
      );
      expect(response.status).toBe(401);
      expect(response.headers.get("www-authenticate")).toBe("Bearer");
      expect(await readError(response)).toBe("unauthorized");
    }
  });

  it("checks the write scope before method handling", async () => {
    expect(
      (await routes.captures.PUT(apiRequest("/captures", { method: "PUT" })))
        .status,
    ).toBe(401);
    const response = await routes.captures.PUT(
      apiRequest("/captures", { token: WRITE_TOKEN, method: "PUT" }),
    );
    expect(response.status).toBe(405);
    expect(await readError(response)).toBe("method_not_allowed");
  });
});

describe("GET /captures", () => {
  beforeEach(() => {
    dbModule
      .getDb()
      .insert(schema.captures)
      .values([
        {
          id: "capture-b",
          rawInput: "同じ時刻のB",
          status: "pending",
          createdAt: "2026-01-02T00:00:00.000Z",
        },
        {
          id: "capture-a",
          rawInput: "同じ時刻のA",
          status: "pending",
          createdAt: "2026-01-02T00:00:00.000Z",
        },
        {
          id: "capture-new",
          rawInput: "新しい未整理",
          status: "pending",
          createdAt: "2026-01-03T00:00:00.000Z",
        },
        {
          id: "capture-discarded",
          rawInput: "破棄済み",
          status: "discarded",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ])
      .run();
  });

  it("returns pending captures by default in createdAt/id order", async () => {
    const response = await routes.captures.GET(apiRequest("/captures"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const data = await readData(response);
    expect(
      (data.captures as Array<{ id: string }>).map((capture) => capture.id),
    ).toEqual(["capture-a", "capture-b", "capture-new"]);
  });

  it("filters by status and returns all with all", async () => {
    const discarded = await readData(
      await routes.captures.GET(apiRequest("/captures?status=discarded")),
    );
    expect(
      (discarded.captures as Array<{ id: string }>).map((capture) => capture.id),
    ).toEqual(["capture-discarded"]);

    const organized = await readData(
      await routes.captures.GET(apiRequest("/captures?status=organized")),
    );
    expect(organized.captures).toEqual([]);

    const all = await readData(
      await routes.captures.GET(apiRequest("/captures?status=all")),
    );
    expect(
      (all.captures as Array<{ id: string }>).map((capture) => capture.id),
    ).toEqual([
      "capture-discarded",
      "capture-a",
      "capture-b",
      "capture-new",
    ]);
  });

  it("returns 400 for an invalid status and ignores unknown parameters", async () => {
    const invalid = await routes.captures.GET(
      apiRequest("/captures?status=unknown"),
    );
    expect(invalid.status).toBe(400);
    expect(await readError(invalid)).toBe("validation_error");

    const empty = await routes.captures.GET(
      apiRequest("/captures?status="),
    );
    expect(empty.status).toBe(400);

    const unknown = await routes.captures.GET(
      apiRequest("/captures?limit=3&foo=bar"),
    );
    expect(unknown.status).toBe(200);
  });
});

describe("POST /captures", () => {
  it("creates a pending muse capture without processing rawInput", async () => {
    const rawInput = "  先頭の空白\n二行目\tタブ\n\n末尾の空白  \n";
    const body = validBody({
      rawInput,
      stockHint: "  キオクシア  ",
    });
    const response = await routes.captures.POST(captureRequest(body));
    expect(response.status).toBe(201);
    const data = await readData(response);
    expect(data.replayed).toBe(false);
    const capture = data.capture as Record<string, unknown>;

    expect(capture).toMatchObject({
      rawInput,
      stockId: null,
      stockHint: "  キオクシア  ",
      origin: "muse",
      status: "pending",
      decisionId: null,
      organizedAt: null,
    });
    expect(typeof capture.id).toBe("string");
    expect(typeof capture.createdAt).toBe("string");

    const db = dbModule.getDb();
    expect(db.select().from(schema.captures).all()).toHaveLength(1);
    const request = db.select().from(schema.integrationRequests).get()!;
    expect(request).toMatchObject({
      clientRequestId: body.clientRequestId,
      endpoint: "POST /captures",
      resourceType: "capture",
      resourceId: capture.id,
    });

    const listed = await readData(
      await routes.captures.GET(apiRequest("/captures?status=all")),
    );
    expect(listed.captures).toEqual([capture]);
  });

  it("accepts an existing stockId and preserves the capture shape", async () => {
    const body = validBody({ stockId: STOCK.id, stockHint: "テスト社" });
    const response = await routes.captures.POST(captureRequest(body));
    expect(response.status).toBe(201);
    const capture = (await readData(response)).capture as Record<
      string,
      unknown
    >;
    expect(capture.stockId).toBe(STOCK.id);
    expect(capture.stockHint).toBe("テスト社");
  });

  it("replays the same key and body without writing again", async () => {
    const body = validBody();
    const first = await routes.captures.POST(captureRequest(body));
    expect(first.status).toBe(201);
    const firstCapture = (await readData(first)).capture as Record<
      string,
      unknown
    >;

    const second = await routes.captures.POST(
      captureRequest({
        ...body,
        clientRequestId: body.clientRequestId.toUpperCase(),
      }),
    );
    expect(second.status).toBe(200);
    const secondData = await readData(second);
    expect(secondData.replayed).toBe(true);
    expect((secondData.capture as Record<string, unknown>).id).toBe(
      firstCapture.id,
    );

    const db = dbModule.getDb();
    expect(db.select().from(schema.captures).all()).toHaveLength(1);
    expect(db.select().from(schema.integrationRequests).all()).toHaveLength(1);
    expect(
      db.select().from(schema.integrationRequests).get()!.clientRequestId,
    ).toBe(body.clientRequestId.toLowerCase());
  });

  it("returns the current resource on replay", async () => {
    const body = validBody();
    await routes.captures.POST(captureRequest(body));
    const db = dbModule.getDb();
    const id = db.select().from(schema.captures).get()!.id;
    db.update(schema.captures)
      .set({ stockHint: "現在のヒント" })
      .run();

    const replay = await routes.captures.POST(captureRequest(body));
    expect(replay.status).toBe(200);
    const capture = (await readData(replay)).capture as Record<
      string,
      unknown
    >;
    expect(capture.id).toBe(id);
    expect(capture.stockHint).toBe("現在のヒント");
  });

  it("returns 409 when the same key has a different body", async () => {
    const body = validBody();
    const first = await routes.captures.POST(captureRequest(body));
    expect(first.status).toBe(201);

    const second = await routes.captures.POST(
      captureRequest({ ...body, rawInput: "別の本文" }),
    );
    expect(second.status).toBe(409);
    expect(await readError(second)).toBe("idempotency_key_reused");
    expect(
      dbModule.getDb().select().from(schema.captures).all(),
    ).toHaveLength(1);
  });

  it("returns 409 when the same key was used by another endpoint", async () => {
    const body = validBody();
    dbModule
      .getDb()
      .insert(schema.integrationRequests)
      .values({
        clientRequestId: body.clientRequestId,
        endpoint: "POST /decisions",
        requestHash: "different-endpoint-hash",
        resourceType: "decision",
        resourceId: "decision-x",
        createdAt: "2026-01-01T00:00:00.000Z",
      })
      .run();

    const response = await routes.captures.POST(captureRequest(body));
    expect(response.status).toBe(409);
    expect(await readError(response)).toBe("idempotency_key_reused");
    expect(dbModule.getDb().select().from(schema.captures).all()).toHaveLength(
      0,
    );
  });

  it("rejects invalid bodies without recording the key", async () => {
    const cases = [
      { ...validBody(), clientRequestId: undefined },
      { ...validBody(), clientRequestId: "" },
      { ...validBody(), clientRequestId: "not-a-uuid" },
      { ...validBody(), rawInput: "" },
      { ...validBody(), rawInput: " \n\t " },
      { ...validBody(), rawInput: 42 },
      { ...validBody(), stockId: "" },
      { ...validBody(), stockId: 42 },
    ];

    for (const body of cases) {
      const response = await routes.captures.POST(captureRequest(body));
      expect(response.status).toBe(400);
      expect(await readError(response)).toBe("validation_error");
    }

    const malformed = await routes.captures.POST(
      apiRequest("/captures", {
        token: WRITE_TOKEN,
        method: "POST",
        rawBody: "{",
      }),
    );
    expect(malformed.status).toBe(400);
    expect(await readError(malformed)).toBe("validation_error");

    expect(dbModule.getDb().select().from(schema.captures).all()).toHaveLength(
      0,
    );
    expect(
      dbModule.getDb().select().from(schema.integrationRequests).all(),
    ).toHaveLength(0);
  });

  it("returns 404 for a missing stock without a partial write or key", async () => {
    const body = validBody({ stockId: "missing-stock" });
    const response = await routes.captures.POST(captureRequest(body));
    expect(response.status).toBe(404);
    expect(await readError(response)).toBe("not_found");

    const db = dbModule.getDb();
    expect(db.select().from(schema.captures).all()).toHaveLength(0);
    expect(db.select().from(schema.integrationRequests).all()).toHaveLength(0);

    const retry = await routes.captures.POST(
      captureRequest({ ...body, stockId: STOCK.id }),
    );
    expect(retry.status).toBe(201);
  });
});
