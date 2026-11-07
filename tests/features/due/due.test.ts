import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

const directory = mkdtempSync(path.join(os.tmpdir(), "ruletrade-due-"));
process.env.RULETRADE_DATABASE_PATH = path.join(directory, "journal.sqlite");
let due: typeof import("@/features/due/due");
let database: typeof import("@/lib/db");
let decisionActions: typeof import("@/features/decisions/actions");
let transactionActions: typeof import("@/features/transactions/actions");

beforeAll(async () => {
  due = await import("@/features/due/due");
  database = await import("@/lib/db");
  decisionActions = await import("@/features/decisions/actions");
  transactionActions = await import("@/features/transactions/actions");
});
beforeEach(() => {
  database
    .getDb()
    .$client.exec(
      "DELETE FROM reviews; DELETE FROM transactions; DELETE FROM decisions; DELETE FROM stocks;",
    );
});
afterAll(() => {
  database.getDb().$client.close();
  rmSync(directory, { recursive: true, force: true });
});

function saveDecision(name: string, reviewDates: string[]) {
  return decisionActions.saveDecisionAction({
    type: "note",
    stock: { name, ticker: null, market: null },
    rawInput: "架空の判断メモ",
    thesis: null,
    assumptions: [],
    reviewConditions: [],
    addConditions: [],
    followUpQuestion: null,
    transaction: null,
    reviewDates,
  });
}

function saveReview(stockId: string, decisionId: string, currentInput: string) {
  return decisionActions.saveReviewAction({
    stockId,
    decisionId,
    currentInput,
    summary: "振り返りの要約",
    differences: [],
    reflection: "振り返りの本文",
  });
}

it("returns reviews due on the day or past, but not before the review date", async () => {
  const asOf = "2026-03-10T00:00:00.000Z";
  const today = await saveDecision("期限当日社", [asOf]);
  const past = await saveDecision("期限切れ社", ["2026-03-09T00:00:00.000Z"]);
  await saveDecision("期限前社", ["2026-03-11T00:00:00.000Z"]);

  const items = await due.listDueDecisions(asOf);

  expect(items.map(({ stock }) => stock.name)).toEqual([
    "期限切れ社",
    "期限当日社",
  ]);
  expect(items.map(({ decision }) => decision.id)).toEqual([
    past.decisionId,
    today.decisionId,
  ]);
  expect(items.map(({ dueReviewAt }) => dueReviewAt)).toEqual([
    "2026-03-09T00:00:00.000Z",
    "2026-03-10T00:00:00.000Z",
  ]);
  expect(items.map(({ dueOn }) => dueOn)).toEqual(["2026-03-09", "2026-03-10"]);
});

it("keeps the original reviewAt and adopts the next date after a review", async () => {
  const first = "2026-01-01T12:00:00.000Z";
  const second = "2026-02-01T12:00:00.000Z";
  const saved = await saveDecision("複数期限社", [second, first]);

  const firstDue = await due.listDueDecisions(first);
  expect(firstDue).toHaveLength(1);
  expect(firstDue[0]).toMatchObject({
    dueReviewAt: first,
    dueOn: "2026-01-01",
    decision: { reviewAt: first },
  });

  vi.useFakeTimers();
  try {
    vi.setSystemTime("2026-01-10T00:00:00.000Z");
    await saveReview(saved.stockId, saved.decisionId, "1回目の振り返り");
  } finally {
    vi.useRealTimers();
  }

  expect(await due.listDueDecisions("2026-01-31T23:59:59.000Z")).toEqual([]);

  const secondDue = await due.listDueDecisions(second);
  expect(secondDue).toHaveLength(1);
  expect(secondDue[0]).toMatchObject({
    dueReviewAt: second,
    dueOn: "2026-02-01",
    decision: { id: saved.decisionId, reviewAt: first },
  });
});

it("returns only the earliest adopted date when several dates have passed", async () => {
  const saved = await saveDecision("複数到来社", [
    "2026-03-03T12:00:00.000Z",
    "2026-03-01T12:00:00.000Z",
    "2026-03-02T12:00:00.000Z",
  ]);

  const items = await due.listDueDecisions("2026-03-10T00:00:00.000Z");

  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({
    decision: { id: saved.decisionId },
    dueReviewAt: "2026-03-01T12:00:00.000Z",
    dueOn: "2026-03-01",
  });
});

it("computes dueOn from the JST calendar day of dueReviewAt", async () => {
  await saveDecision("日付境界社", ["2026-03-09T15:30:00.000Z"]);

  const items = await due.listDueDecisions("2026-03-10T00:00:00.000Z");

  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({
    dueReviewAt: "2026-03-09T15:30:00.000Z",
    dueOn: "2026-03-10",
  });
});

it("returns all transactions without a linked decision, newest first", async () => {
  const saved = await saveDecision("理由あり社", []);
  const linked = await transactionActions.createTransactionAction({
    stockId: saved.stockId,
    side: "buy",
    quantity: 10,
    price: 500,
    fee: 0,
    executedAt: "2026-03-01T00:00:00.000Z",
    decisionId: saved.decisionId,
  });
  const older = await transactionActions.createTransactionAction({
    stockId: saved.stockId,
    side: "buy",
    quantity: 5,
    price: 400,
    fee: 0,
    executedAt: "2026-03-02T00:00:00.000Z",
  });
  const newer = await transactionActions.createTransactionAction({
    stockId: saved.stockId,
    side: "sell",
    quantity: 5,
    price: 600,
    fee: 0,
    executedAt: "2026-03-03T00:00:00.000Z",
  });

  const items = await due.listUnlinkedTransactions();

  expect(items.map(({ transaction }) => transaction.id)).toEqual([
    newer.id,
    older.id,
  ]);
  expect(
    items.every(({ transaction }) => transaction.decisionId === null),
  ).toBe(true);
  expect(items.some(({ transaction }) => transaction.id === linked.id)).toBe(
    false,
  );
  expect(items.every(({ stock }) => stock.name === "理由あり社")).toBe(true);
});

it("keeps the stored origin and ignores decisions without reviewAt", async () => {
  const saved = await saveDecision("出所確認社", ["2026-04-01T12:00:00.000Z"]);
  const noReview = await saveDecision("期限なし社", []);
  database
    .getDb()
    .$client.prepare("UPDATE decisions SET origin = 'muse' WHERE id = ?")
    .run(saved.decisionId);

  const items = await due.listDueDecisions("2026-04-02T00:00:00.000Z");

  expect(items).toHaveLength(1);
  expect(items[0].decision).toMatchObject({
    id: saved.decisionId,
    origin: "muse",
  });
  expect(
    items.some(({ decision }) => decision.id === noReview.decisionId),
  ).toBe(false);
});
