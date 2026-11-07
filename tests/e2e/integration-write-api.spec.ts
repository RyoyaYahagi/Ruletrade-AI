import { expect, test, type APIRequestContext } from "@playwright/test";
import Database from "better-sqlite3";
import path from "node:path";
import { randomUUID } from "node:crypto";

const READ_TOKEN = "e2e-read-token";
const WRITE_TOKEN = "e2e-write-token";
const STOCK_TIMELINE_API = "/api/integration/v1/stocks";
const DATABASE_PATH = path.join(process.cwd(), ".data/e2e-test.sqlite");

type ApiDecision = {
  id: string;
  stockId: string;
  rawInput: string;
  summary: string | null;
  reviewDates: string[];
  reviewAt: string | null;
  decidedAt: string | null;
  origin: "web" | "muse";
};

type ApiCapture = {
  id: string;
  stockId: string | null;
  rawInput: string;
  origin: "web" | "muse";
  status: "pending" | "organized" | "discarded";
  decisionId: string | null;
  organizedAt: string | null;
};

type ApiReview = {
  id: string;
  decisionId: string | null;
  currentInput: string;
  reflection: string;
  origin: "web" | "muse";
};

function auth(token = WRITE_TOKEN, json = false): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    ...(json ? { "content-type": "application/json" } : {}),
  };
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

async function postJson(
  request: APIRequestContext,
  pathname: string,
  data: unknown,
) {
  return request.post(pathname, { headers: auth(WRITE_TOKEN, true), data });
}

test("carries a capture through decision, link, review, and the Muse timeline label", async ({
  page,
}) => {
  const suffix = randomUUID().slice(0, 8);
  const stockId = randomUUID();
  const stockName = `Muse連携テスト ${suffix}`;
  const transactionId = randomUUID();
  const captureRequestId = randomUUID();
  const decisionRequestId = randomUUID();
  const linkRequestId = randomUUID();
  const reviewRequestId = randomUUID();
  const captureRawInput = `  受け箱の原文 ${suffix}\n二行目  `;
  const decisionRawInput = `受け箱から確定した判断 ${suffix}`;
  const currentInput = `いまの考え ${suffix}`;
  const reflection = `  本人の振り返り ${suffix}\nそのまま  `;
  const reviewDates = [
    "2026-12-07T12:00:00.000Z",
    "2026-11-07T12:00:00.000Z",
    "2026-12-07T12:00:00.000Z",
  ];
  let captureId: string | null = null;

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
    db.prepare(
      `INSERT INTO transactions
         (id, stock_id, side, quantity, price, fee, executed_at, decision_id, created_at, price_currency, fee_currency)
       VALUES (?, ?, 'buy', 100, 2500, 550, ?, NULL, ?, 'JPY', 'JPY')`,
    ).run(
      transactionId,
      stockId,
      "2026-11-07T12:00:00.000Z",
      "2026-11-07T12:05:00.000Z",
    );
  });

  try {
    const captureResponse = await postJson(
      page.request,
      "/api/integration/v1/captures",
      {
        clientRequestId: captureRequestId,
        rawInput: captureRawInput,
        stockId: null,
        stockHint: stockName,
      },
    );
    expect(captureResponse.status()).toBe(201);
    const capture = (
      (await captureResponse.json()) as {
        data: { capture: ApiCapture };
      }
    ).data.capture;
    expect(capture).toMatchObject({
      stockId: null,
      rawInput: captureRawInput,
      origin: "muse",
      status: "pending",
    });
    captureId = capture.id;

    const decisionResponse = await postJson(
      page.request,
      "/api/integration/v1/decisions",
      {
        clientRequestId: decisionRequestId,
        stockId,
        captureId: capture.id,
        type: "buy",
        rawInput: decisionRawInput,
        thesis: `仮説 ${suffix}`,
        reviewDates,
      },
    );
    expect(decisionResponse.status()).toBe(201);
    const decisionData = (await decisionResponse.json()) as {
      data: { decision: ApiDecision; capture: ApiCapture };
    };
    expect(decisionData.data.decision).toMatchObject({
      stockId,
      rawInput: decisionRawInput,
      summary: `仮説 ${suffix}`,
      reviewAt: "2026-11-07T12:00:00.000Z",
      reviewDates: ["2026-11-07T12:00:00.000Z", "2026-12-07T12:00:00.000Z"],
      origin: "muse",
    });
    expect(decisionData.data.capture).toMatchObject({
      id: capture.id,
      stockId: null,
      rawInput: captureRawInput,
      origin: "muse",
      status: "organized",
      decisionId: decisionData.data.decision.id,
    });
    expect(typeof decisionData.data.capture.organizedAt).toBe("string");

    const linkResponse = await postJson(
      page.request,
      `/api/integration/v1/transactions/${transactionId}/decision-link`,
      {
        clientRequestId: linkRequestId,
        decisionId: decisionData.data.decision.id,
      },
    );
    expect(linkResponse.status()).toBe(200);
    const linkData = (await linkResponse.json()) as {
      data: {
        replayed: boolean;
        transaction: { id: string; decisionId: string | null };
        decision: ApiDecision;
        previousDecisionId: string | null;
      };
    };
    expect(linkData.data.replayed).toBe(false);
    expect(linkData.data.previousDecisionId).toBeNull();
    expect(linkData.data.transaction).toMatchObject({
      id: transactionId,
      decisionId: decisionData.data.decision.id,
    });

    const reviewResponse = await postJson(
      page.request,
      "/api/integration/v1/reviews",
      {
        clientRequestId: reviewRequestId,
        stockId,
        decisionId: decisionData.data.decision.id,
        currentInput,
        summary: `比較の要約 ${suffix}`,
        differences: ["在庫の見方"],
        reflection,
      },
    );
    expect(reviewResponse.status()).toBe(201);
    const reviewData = (await reviewResponse.json()) as {
      data: { review: ApiReview; decision: ApiDecision };
    };
    expect(reviewData.data.review).toMatchObject({
      decisionId: decisionData.data.decision.id,
      currentInput,
      reflection: `本人の振り返り ${suffix}\nそのまま`,
      origin: "muse",
    });

    const timelineResponse = await page.request.get(
      `${STOCK_TIMELINE_API}/${stockId}`,
      { headers: auth(READ_TOKEN) },
    );
    expect(timelineResponse.status()).toBe(200);
    const timeline = (await timelineResponse.json()) as {
      data: {
        timeline: Array<{
          kind: string;
          decision?: ApiDecision;
          review?: ApiReview;
        }>;
      };
    };
    expect(
      timeline.data.timeline.find((item) => item.kind === "decision")?.decision
        ?.origin,
    ).toBe("muse");
    expect(
      timeline.data.timeline.find((item) => item.kind === "review")?.review
        ?.origin,
    ).toBe("muse");

    await page.goto(`/stocks/${stockId}`);
    await expect(
      page.getByText(decisionRawInput, { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Museから保存", { exact: true })).toHaveCount(
      1,
    );
    await expect(
      page.getByText(`関連売買: 購入 100株`, { exact: false }),
    ).toBeVisible();

    await page.goto(`/stocks/${stockId}?tab=reviews`);
    await expect(page.getByText(currentInput, { exact: false })).toBeVisible();
    await expect(
      page.getByText(`本人の振り返り ${suffix}`, { exact: false }),
    ).toBeVisible();
    await expect(page.getByText("Museから保存", { exact: true })).toBeVisible();
  } finally {
    withDatabase((db) => {
      db.prepare(
        "DELETE FROM integration_requests WHERE client_request_id IN (?, ?, ?, ?)",
      ).run(
        captureRequestId,
        decisionRequestId,
        linkRequestId,
        reviewRequestId,
      );
      db.prepare("DELETE FROM captures WHERE id = ?").run(
        captureId ?? "missing-capture",
      );
      db.prepare("DELETE FROM reviews WHERE stock_id = ?").run(stockId);
      db.prepare("DELETE FROM transactions WHERE stock_id = ?").run(stockId);
      db.prepare("DELETE FROM decisions WHERE stock_id = ?").run(stockId);
      db.prepare("DELETE FROM stocks WHERE id = ?").run(stockId);
    });
  }
});
