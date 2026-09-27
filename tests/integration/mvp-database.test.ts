import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testDirectory = mkdtempSync(path.join(os.tmpdir(), "ruletrade-mvp-test-"));
const databasePath = path.join(testDirectory, "journal.sqlite");
process.env.RULETRADE_DATABASE_PATH = databasePath;

const timestamp = "2026-01-02T03:04:05.000Z";
const rawInput = "キオクシアを100株買った。AI向けNAND需要に期待している。";

describe("MVP database actions", () => {
  let database: typeof import("@/lib/db");
  let decisionActions: typeof import("@/features/decisions/actions");
  let transactionActions: typeof import("@/features/transactions/actions");

  beforeAll(async () => {
    database = await import("@/lib/db");
    decisionActions = await import("@/features/decisions/actions");
    transactionActions = await import("@/features/transactions/actions");
  });

  afterAll(() => {
    database.getDb().$client.close();
    rmSync(testDirectory, { recursive: true, force: true });
  });

  it("preserves the original text and saves an unknown transaction price as null", async () => {
    const saved = await decisionActions.saveDecisionAction({
      type: "buy",
      stock: { ticker: "285A", name: "キオクシア", market: "JP" },
      thesis: "AI向けNAND需要",
      assumptions: [],
      reviewConditions: ["データセンター需要の鈍化"],
      addConditions: [],
      followUpQuestion: null,
      transaction: {
        side: "buy",
        quantity: 100,
        price: null,
        fee: null,
        executedAt: timestamp,
      },
      rawInput,
      transcript: null,
    });

    const timeline = await decisionActions.getStockTimelineAction({ stockId: saved.stockId });
    const allTransactions = await transactionActions.listTransactionsAction();

    expect(timeline.decisions).toHaveLength(1);
    expect(timeline.decisions[0]?.rawInput).toBe(rawInput);
    expect(timeline.transactions).toHaveLength(1);
    expect(timeline.transactions[0]).toMatchObject({
      side: "buy",
      quantity: 100,
      price: null,
      decisionId: saved.decisionId,
    });
    expect(allTransactions).toHaveLength(1);
    expect(allTransactions[0]?.price).toBeNull();
  });

  it("rolls back the stock and decision if saving its transaction fails", async () => {
    const db = database.getDb();
    db.$client.exec(`
      CREATE TRIGGER fail_transaction_insert
      BEFORE INSERT ON transactions
      BEGIN
        SELECT RAISE(ABORT, 'forced transaction failure');
      END;
    `);
    const stockName = `Rollback ${Date.now()}`;

    try {
      await expect(
        decisionActions.saveDecisionAction({
          type: "buy",
          stock: { ticker: null, name: stockName, market: null },
          thesis: null,
          assumptions: [],
          reviewConditions: [],
          addConditions: [],
          followUpQuestion: null,
          transaction: null,
          transactionInput: {
            side: "buy",
            quantity: 10,
            price: null,
            fee: null,
            executedAt: timestamp,
          },
          rawInput: "記録保存の原子性を確認する。",
          transcript: null,
        }),
      ).rejects.toThrow("forced transaction failure");

      expect((await decisionActions.listStocksAction()).some((stock) => stock.name === stockName)).toBe(false);
      expect((await decisionActions.listRecentDecisionsAction({ limit: 100 })).some(
        ({ stock }) => stock.name === stockName,
      )).toBe(false);
    } finally {
      db.$client.exec("DROP TRIGGER IF EXISTS fail_transaction_insert");
    }
  });

  it("rejects a transaction or review linked to a decision for another stock", async () => {
    const first = await decisionActions.saveDecisionAction({
      type: "buy",
      stock: { ticker: "AAA", name: "First stock", market: null },
      thesis: "first hypothesis",
      assumptions: [],
      reviewConditions: [],
      addConditions: [],
      followUpQuestion: null,
      transaction: null,
      rawInput: "First stock decision",
      transcript: null,
    });
    const second = await decisionActions.saveDecisionAction({
      type: "note",
      stock: { ticker: "BBB", name: "Second stock", market: null },
      thesis: "second note",
      assumptions: [],
      reviewConditions: [],
      addConditions: [],
      followUpQuestion: null,
      transaction: null,
      rawInput: "Second stock decision",
      transcript: null,
    });

    await expect(
      transactionActions.createTransactionAction({
        stockId: second.stockId,
        decisionId: first.decisionId,
        side: "buy",
        quantity: 1,
        price: null,
        fee: null,
        executedAt: timestamp,
      }),
    ).rejects.toThrow("Transaction decision must belong to the selected stock");

    await expect(
      decisionActions.saveReviewAction({
        stockId: second.stockId,
        decisionId: first.decisionId,
        currentInput: "Current thinking",
        summary: "Summary",
        differences: [],
        reflection: "この判断は今後も事業条件を基準に見直す。",
      }),
    ).rejects.toThrow("Review decision must belong to the selected stock");
  });

  it("lists decisions whose review date has arrived", async () => {
    const overdue = await decisionActions.saveDecisionAction({
      type: "buy",
      stock: { ticker: null, name: "Overdue review stock", market: null },
      thesis: "first thesis",
      assumptions: [],
      reviewConditions: [],
      addConditions: [],
      followUpQuestion: null,
      transaction: null,
      reviewAt: "2026-01-01T00:00:00.000Z",
      rawInput: "Review date is in the past.",
      transcript: null,
    });
    const completed = await decisionActions.saveDecisionAction({
      type: "buy",
      stock: { ticker: null, name: "Completed review stock", market: null },
      thesis: "thesis that was reviewed",
      assumptions: [],
      reviewConditions: [],
      addConditions: [],
      followUpQuestion: null,
      transaction: null,
      reviewAt: "2026-01-01T00:00:00.000Z",
      rawInput: "This due review is completed.",
      transcript: null,
    });
    await decisionActions.saveReviewAction({
      stockId: completed.stockId,
      decisionId: completed.decisionId,
      currentInput: "Current thought after the review date.",
      summary: "The user compared the current thought with this decision.",
      differences: [],
      reflection: "The completed review should clear the reminder.",
    });
    await decisionActions.saveDecisionAction({
      type: "buy",
      stock: { ticker: null, name: "Future review stock", market: null },
      thesis: "future thesis",
      assumptions: [],
      reviewConditions: [],
      addConditions: [],
      followUpQuestion: null,
      transaction: null,
      reviewAt: "2099-01-01T00:00:00.000Z",
      rawInput: "Review date is in the future.",
      transcript: null,
    });

    const due = await decisionActions.listDueDecisionsAction();

    expect(due.map(({ decision }) => decision.id)).toContain(overdue.decisionId);
    expect(due.map(({ decision }) => decision.id)).not.toContain(completed.decisionId);
    expect(due.some(({ stock }) => stock.name === "Future review stock")).toBe(false);
  });
});
