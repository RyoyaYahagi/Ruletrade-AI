import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";

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
  expect(items.every(({ decision }) => decision.reviewAt !== null)).toBe(true);
});

it("returns only transactions without a linked decision, newest first", async () => {
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

  const transactions = await due.listUnlinkedTransactions();

  expect(transactions.map((trade) => trade.id)).toEqual([newer.id, older.id]);
  expect(transactions.every((trade) => trade.decisionId === null)).toBe(true);
  expect(transactions.some((trade) => trade.id === linked.id)).toBe(false);
});
