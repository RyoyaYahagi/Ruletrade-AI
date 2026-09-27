import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";

const directory = mkdtempSync(path.join(os.tmpdir(), "ruletrade-link-"));
process.env.RULETRADE_DATABASE_PATH = path.join(directory, "journal.sqlite");
let database: typeof import("@/lib/db");
let actions: typeof import("@/features/transactions/actions");
let decisionActions: typeof import("@/features/decisions/actions");

beforeAll(async () => {
  database = await import("@/lib/db");
  actions = await import("@/features/transactions/actions");
  decisionActions = await import("@/features/decisions/actions");
});
afterAll(() => {
  database.getDb().$client.close();
  rmSync(directory, { recursive: true, force: true });
});

it("links and unlinks a decision on the same stock, rejecting other stocks without changing the link", async () => {
  const save = (name: string) =>
    decisionActions.saveDecisionAction({
      type: "note",
      stock: { ticker: null, name, market: null },
      thesis: null,
      assumptions: [],
      reviewConditions: [],
      addConditions: [],
      followUpQuestion: null,
      transaction: null,
      rawInput: "架空の判断メモ",
      transcript: null,
    });
  const first = await save("架空第一社");
  const second = await save("架空第二社");
  const trade = await actions.createTransactionAction({
    stockId: first.stockId,
    side: "buy",
    quantity: 10,
    price: 500,
    fee: 0,
    executedAt: "2026-01-01T12:00:00.000Z",
  });
  await actions.linkTransactionDecisionAction({
    id: trade.id,
    decisionId: first.decisionId,
  });
  expect((await actions.listTransactionsAction())[0].decisionId).toBe(
    first.decisionId,
  );
  await expect(
    actions.linkTransactionDecisionAction({
      id: trade.id,
      decisionId: second.decisionId,
    }),
  ).rejects.toThrow("同じ銘柄");
  expect((await actions.listTransactionsAction())[0].decisionId).toBe(
    first.decisionId,
  );
  await expect(
    actions.linkTransactionDecisionAction({ id: "missing", decisionId: null }),
  ).rejects.toThrow("見つかりません");
  await actions.linkTransactionDecisionAction({
    id: trade.id,
    decisionId: null,
  });
  expect((await actions.listTransactionsAction())[0].decisionId).toBeNull();
});
