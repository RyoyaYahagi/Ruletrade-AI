import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  findTransactionCandidates,
  japanDate,
  initialDecisionType,
} from "@/features/transactions/matching";
import type { DecisionType } from "@/schemas/decision";

const directory = mkdtempSync(path.join(os.tmpdir(), "ruletrade-capture-"));
process.env.RULETRADE_DATABASE_PATH = path.join(directory, "journal.sqlite");
let actions: typeof import("@/features/decisions/actions");
let trades: typeof import("@/features/transactions/actions");
let database: typeof import("@/lib/db");
beforeAll(async () => {
  actions = await import("@/features/decisions/actions");
  trades = await import("@/features/transactions/actions");
  database = await import("@/lib/db");
});
afterAll(() => {
  database.getDb().$client.close();
  rmSync(directory, { recursive: true, force: true });
});
const input = {
  type: "buy",
  stock: { name: "架空判断社", ticker: null, market: null },
  rawInput: "過去の判断",
  thesis: null,
  assumptions: [],
  reviewConditions: [],
  addConditions: [],
  followUpQuestion: null,
  transaction: null,
  decidedAt: "2026-02-14",
};

it.each<[DecisionType, "buy" | "sell", boolean]>([
  ["buy", "buy", true],
  ["add", "buy", true],
  ["sell", "sell", true],
  ["buy", "sell", false],
  ["note", "buy", false],
  ["thesis_update", "buy", false],
  ["sell_consideration", "sell", false],
])("matches %s against %s: %s", async (type, side, matches) => {
  const seed = await actions.saveDecisionAction({
    ...input,
    stock: { ...input.stock, name: `${type}-${side}` },
    type: "note",
  });
  const trade = await trades.createTransactionAction({
    stockId: seed.stockId,
    side,
    quantity: 10,
    price: 500,
    fee: null,
    executedAt: "2026-02-13T15:00:00.000Z",
  });
  const saved = await actions.saveDecisionAction({
    ...input,
    type,
    stockId: seed.stockId,
  });
  expect(saved.transactionId).toBe(matches ? trade.id : null);
  const timeline = await actions.getStockTimelineAction({
    stockId: seed.stockId,
  });
  expect(timeline.transactions).toHaveLength(1);
  expect(
    timeline.decisions.find((decision) => decision.id === saved.decisionId)
      ?.decidedAt,
  ).toBe("2026-02-14");
});

it("stores the exact follow-up question and answer with summary and grounded points", async () => {
  const saved = await actions.saveDecisionAction({
    type: "note",
    stock: { name: "質問保存社", ticker: null, market: null },
    rawInput: "需要が続きそうだと思う。",
    summary: "需要の継続を期待する。",
    points: [{ kind: "expectation", text: "需要が続きそう", source: "raw_input" }],
    followUpQuestion: "需要を何で確認しますか？",
    followUpAnswer: "次の決算を見る。",
    transaction: null,
    reviewDates: [],
    decidedAt: "2026-02-14",
  });
  const timeline = await actions.getStockTimelineAction({ stockId: saved.stockId });
  expect(timeline.decisions[0]).toMatchObject({
    rawInput: "需要が続きそうだと思う。",
    summary: "需要の継続を期待する。",
    points: [{ kind: "expectation", text: "需要が続きそう", source: "raw_input" }],
    followUpQuestion: "需要を何で確認しますか？",
    followUpAnswer: "次の決算を見る。",
  });
  expect(timeline.transactions).toHaveLength(0);
});

it("leaves multiple candidates unlinked, accepts explicit selection, and rejects occupied and cross-stock trades atomically", async () => {
  const seed = await actions.saveDecisionAction({ ...input, type: "note" });
  const create = () =>
    trades.createTransactionAction({
      stockId: seed.stockId,
      side: "buy",
      quantity: 100,
      price: 1440,
      fee: null,
      executedAt: "2026-02-14T00:00:00.000Z",
    });
  const first = await create();
  const second = await create();
  const ambiguous = await actions.saveDecisionAction({
    ...input,
    stockId: seed.stockId,
  });
  expect(ambiguous.transactionId).toBeNull();
  const linked = await actions.saveDecisionAction({
    ...input,
    stockId: seed.stockId,
    existingTransactionId: second.id,
    transactionInput: {
      side: "buy",
      quantity: 100,
      price: 1440,
      fee: null,
      executedAt: first.executedAt,
    },
  });
  expect(linked.transactionId).toBe(second.id);
  let timeline = await actions.getStockTimelineAction({
    stockId: seed.stockId,
  });
  expect(timeline.transactions).toHaveLength(2);
  expect(
    findTransactionCandidates(
      timeline.transactions,
      "buy",
      input.decidedAt,
      seed.stockId,
    ).map((trade) => trade.id),
  ).toEqual([first.id]);
  const count = timeline.decisions.length;
  await expect(
    actions.saveDecisionAction({
      ...input,
      stockId: seed.stockId,
      existingTransactionId: second.id,
    }),
  ).rejects.toThrow("紐付けできません");
  const other = await actions.saveDecisionAction({
    ...input,
    stock: { ...input.stock, name: "架空別社" },
    type: "note",
  });
  await expect(
    actions.saveDecisionAction({
      ...input,
      stockId: other.stockId,
      existingTransactionId: first.id,
    }),
  ).rejects.toThrow("紐付けできません");
  timeline = await actions.getStockTimelineAction({ stockId: seed.stockId });
  expect(timeline.decisions).toHaveLength(count);
  const unlinked = await actions.saveDecisionAction({
    ...input,
    stockId: seed.stockId,
    existingTransactionId: null,
  });
  expect(unlinked.transactionId).toBeNull();
});

it("uses Japan calendar days without shifting date-only input and initializes the trade type", () => {
  expect(japanDate("2026-02-14")).toBe("2026-02-14");
  expect(japanDate("2026-02-13T15:00:00Z")).toBe("2026-02-14");
  expect(japanDate("2026-02-14T14:59:59Z")).toBe("2026-02-14");
  expect(japanDate("2026-02-14T15:00:00Z")).toBe("2026-02-15");
  expect(initialDecisionType({ side: "buy" })).toBe("buy");
  expect(initialDecisionType({ side: "sell" })).toBe("sell");
});
