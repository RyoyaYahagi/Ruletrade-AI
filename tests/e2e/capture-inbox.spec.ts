import { expect, test, type APIRequestContext } from "@playwright/test";
import Database from "better-sqlite3";
import path from "node:path";
import { randomUUID } from "node:crypto";

const READ_TOKEN = "e2e-read-token";
const WRITE_TOKEN = "e2e-write-token";
const CAPTURES_API = "/api/integration/v1/captures";
const DATABASE_PATH = path.join(process.cwd(), ".data/e2e-test.sqlite");

type ApiCapture = {
  id: string;
  stockId: string | null;
  stockHint: string | null;
  rawInput: string;
  origin: "web" | "muse";
  status: "pending" | "organized" | "discarded";
  decisionId: string | null;
  createdAt: string;
  organizedAt: string | null;
};

function auth(token: string, json = false): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    ...(json ? { "content-type": "application/json" } : {}),
  };
}

async function listCaptures(
  request: APIRequestContext,
  status = "all",
): Promise<ApiCapture[]> {
  const response = await request.get(`${CAPTURES_API}?status=${status}`, {
    headers: auth(READ_TOKEN),
  });
  expect(response.status()).toBe(200);
  return ((await response.json()) as { data: { captures: ApiCapture[] } }).data
    .captures;
}

function withDatabase<T>(run: (db: Database.Database) => T): T {
  const db = new Database(DATABASE_PATH);
  db.pragma("foreign_keys = ON");
  try {
    return run(db);
  } finally {
    db.close();
  }
}

test("saves the exact web text to the inbox and reads it through the API without AI", async ({
  page,
}) => {
  let aiCalls = 0;
  await page.route("**/api/decisions/extract", (route) => {
    aiCalls += 1;
    return route.fulfill({ json: {} });
  });
  await page.route("**/api/decisions/transcribe", (route) => {
    aiCalls += 1;
    return route.fulfill({ json: { transcript: "" } });
  });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/capture");
  await expect(
    page.getByRole("heading", { name: "考えをそのまま残す" }),
  ).toBeVisible();
  await expect(page.getByLabel("銘柄（任意）")).toHaveValue("");

  const rawInput = `  先頭の空白も残す ${randomUUID()}\n二行目\tタブ\n\n末尾の空白  \n`;
  await page.getByLabel("いま考えていること").fill(rawInput);
  await page.getByRole("button", { name: "受け箱に保存" }).click();

  await expect(page.getByText("受け箱に保存しました")).toBeVisible();
  await expect(page.getByText(/未整理として保存しました/)).toBeVisible();
  await expect(page.getByText("銘柄: 未定")).toBeVisible();
  await expect(
    page.getByText("振り返り日は保存していません。整理するときに決められます。"),
  ).toBeVisible();
  await expect(page.getByText("保存した原文")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: "test-results/r07-capture-mobile.png",
    fullPage: true,
  });

  expect(aiCalls).toBe(0);

  const captures = await listCaptures(page.request);
  const capture = captures.find((item) => item.rawInput === rawInput);
  expect(capture).toBeTruthy();
  expect(capture).toMatchObject({
    stockId: null,
    stockHint: null,
    origin: "web",
    status: "pending",
    decisionId: null,
    organizedAt: null,
  });
  expect(new Date(capture!.createdAt).toISOString()).toBe(capture!.createdAt);
});

test("saves from a stock detail page with the stock fixed", async ({ page }) => {
  await page.goto("/");
  const stockId = randomUUID();
  const stockName = `固定銘柄テスト ${stockId.slice(0, 8)}`;
  withDatabase((db) => {
    db.prepare(
      `INSERT INTO stocks (id, ticker, name, normalized_name, market, market_code, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      stockId,
      null,
      stockName,
      stockName,
      "JP",
      "JP",
      new Date().toISOString(),
    );
  });

  const rawInput = `銘柄を固定して残す ${stockId}`;
  try {
    await page.goto(`/stocks/${stockId}/capture`);
    await expect(page.getByText("記録する銘柄")).toBeVisible();
    await expect(page.getByText(stockName, { exact: true })).toBeVisible();
    await page.getByLabel("いま考えていること").fill(rawInput);
    await page.getByRole("button", { name: "受け箱に保存" }).click();
    await expect(page.getByText("受け箱に保存しました")).toBeVisible();

    const captures = await listCaptures(page.request);
    const capture = captures.find((item) => item.rawInput === rawInput);
    expect(capture).toMatchObject({
      stockId,
      stockHint: null,
      origin: "web",
      status: "pending",
    });

    // 未整理の受け箱は「今日」で新しい順に見返せる。
    await page.goto("/");
    const inbox = page.getByRole("region", { name: /受け箱/ });
    await expect(inbox.getByText(stockName)).toBeVisible();
    await expect(inbox.getByText(`「${rawInput}」`)).toBeVisible();
  } finally {
    withDatabase((db) => {
      db.prepare("DELETE FROM captures WHERE raw_input = ?").run(rawInput);
      db.prepare("DELETE FROM stocks WHERE id = ?").run(stockId);
    });
  }
});

test("enforces auth and status validation and leaves no partial write", async ({
  page,
}) => {
  const noAuth = await page.request.get(CAPTURES_API);
  expect(noAuth.status()).toBe(401);

  const wrongScope = await page.request.get(CAPTURES_API, {
    headers: auth(WRITE_TOKEN),
  });
  expect(wrongScope.status()).toBe(401);

  const invalidStatus = await page.request.get(`${CAPTURES_API}?status=unknown`, {
    headers: auth(READ_TOKEN),
  });
  expect(invalidStatus.status()).toBe(400);
  expect((await invalidStatus.json()).error.code).toBe("validation_error");

  const clientRequestId = randomUUID();
  const rawInput = `存在しない銘柄 ${clientRequestId}`;
  const missingStock = await page.request.post(CAPTURES_API, {
    headers: auth(WRITE_TOKEN, true),
    data: {
      clientRequestId,
      rawInput,
      stockId: "missing-stock",
    },
  });
  expect(missingStock.status()).toBe(404);
  expect((await missingStock.json()).error.code).toBe("not_found");

  const captures = await listCaptures(page.request);
  expect(captures.some((capture) => capture.rawInput === rawInput)).toBe(false);
  expect(
    withDatabase(
      (db) =>
        (
          db
            .prepare(
              "SELECT COUNT(*) AS count FROM integration_requests WHERE client_request_id = ?",
            )
            .get(clientRequestId) as { count: number }
        ).count,
    ),
  ).toBe(0);

  // 失敗したキーは記録されないため、修正して同じキーで再送できる。
  const retry = await page.request.post(CAPTURES_API, {
    headers: auth(WRITE_TOKEN, true),
    data: {
      clientRequestId,
      rawInput,
      stockId: null,
    },
  });
  expect(retry.status()).toBe(201);

  withDatabase((db) => {
    db.prepare("DELETE FROM captures WHERE raw_input = ?").run(rawInput);
    db.prepare(
      "DELETE FROM integration_requests WHERE client_request_id = ?",
    ).run(clientRequestId);
  });
});

test("replays the same key and rejects content and endpoint conflicts", async ({
  page,
}) => {
  const clientRequestId = randomUUID();
  const rawInput = `冪等キーの確認 ${clientRequestId}`;
  const body = {
    clientRequestId,
    rawInput,
    stockId: null,
    stockHint: null,
  };
  const endpointRequestId = randomUUID();

  try {
    const first = await page.request.post(CAPTURES_API, {
      headers: auth(WRITE_TOKEN, true),
      data: body,
    });
    expect(first.status()).toBe(201);
    const firstCapture = ((await first.json()) as { data: { replayed: boolean; capture: ApiCapture } })
      .data.capture;
    expect((firstCapture as ApiCapture).rawInput).toBe(rawInput);

    const second = await page.request.post(CAPTURES_API, {
      headers: auth(WRITE_TOKEN, true),
      data: body,
    });
    expect(second.status()).toBe(200);
    const replay = (await second.json()) as {
      data: { replayed: boolean; capture: ApiCapture };
    };
    expect(replay.data.replayed).toBe(true);
    expect(replay.data.capture.id).toBe(firstCapture.id);

    const contentConflict = await page.request.post(CAPTURES_API, {
      headers: auth(WRITE_TOKEN, true),
      data: { ...body, rawInput: `${rawInput}（別の本文）` },
    });
    expect(contentConflict.status()).toBe(409);
    expect((await contentConflict.json()).error.code).toBe(
      "idempotency_key_reused",
    );

    withDatabase((db) => {
      db.prepare(
        `INSERT INTO integration_requests
           (client_request_id, endpoint, request_hash, resource_type, resource_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        endpointRequestId,
        "POST /decisions",
        "another-endpoint-hash",
        "decision",
        "decision-x",
        new Date().toISOString(),
      );
    });
    const endpointConflict = await page.request.post(CAPTURES_API, {
      headers: auth(WRITE_TOKEN, true),
      data: {
        clientRequestId: endpointRequestId,
        rawInput: `${rawInput}（別エンドポイント）`,
        stockId: null,
      },
    });
    expect(endpointConflict.status()).toBe(409);
    expect((await endpointConflict.json()).error.code).toBe(
      "idempotency_key_reused",
    );

    const matching = (await listCaptures(page.request)).filter(
      (capture) => capture.rawInput === rawInput,
    );
    expect(matching).toHaveLength(1);
  } finally {
    withDatabase((db) => {
      db.prepare("DELETE FROM captures WHERE raw_input LIKE ?").run(
        `${rawInput}%`,
      );
      db.prepare(
        "DELETE FROM integration_requests WHERE client_request_id IN (?, ?)",
      ).run(clientRequestId, endpointRequestId);
    });
  }
});
