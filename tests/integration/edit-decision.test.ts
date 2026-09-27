import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";

const directory = mkdtempSync(
  path.join(os.tmpdir(), "ruletrade-edit-decision-"),
);
process.env.RULETRADE_DATABASE_PATH = path.join(directory, "journal.sqlite");
let actions: typeof import("@/features/decisions/actions");
let database: typeof import("@/lib/db");
beforeAll(async () => {
  actions = await import("@/features/decisions/actions");
  database = await import("@/lib/db");
});
afterAll(() => {
  database.getDb().$client.close();
  rmSync(directory, { recursive: true, force: true });
});
const original = {
  type: "buy",
  stock: { name: "架空編集社", ticker: null, market: null },
  rawInput: "  編集前の判断\n需要を期待する。  ",
  thesis: "編集前の仮説",
  assumptions: ["編集前の前提"],
  reviewConditions: ["編集前の条件"],
  addConditions: [],
  followUpQuestion: null,
  transcript: "編集前の音声原文",
  followUpAnswer: "当時の追加回答",
  decidedAt: "2026-01-01",
  reviewDates: ["2026-02-01T12:00:00.000Z"],
  transaction: {
    side: "buy",
    quantity: 10,
    price: 500,
    fee: null,
    executedAt: "2026-01-01T12:00:00.000Z",
  },
};

it("edits the existing decision, preserves the old content and linked trade, and exports its history", async () => {
  const saved = await actions.saveDecisionAction(original);
  const before = (
    await actions.getStockTimelineAction({ stockId: saved.stockId })
  ).decisions[0];
  await actions.editDecisionAction({
    id: saved.decisionId,
    stockId: saved.stockId,
    expectedRevision: 0,
    type: "add",
    rawInput: "編集後の判断",
    thesis: "修正した仮説",
    decidedAt: "2026-01-02",
    assumptions: ["修正した前提"],
    reviewConditions: ["条件1", "条件2"],
    addConditions: ["買い増し条件"],
    reviewDates: ["2026-03-01T12:00:00.000Z", "2026-02-01T12:00:00.000Z"],
  });
  const after = await actions.getStockTimelineAction({
    stockId: saved.stockId,
  });
  expect(after.decisions).toHaveLength(1);
  expect(after.transactions).toHaveLength(1);
  expect(after.transactions[0]).toMatchObject({
    id: saved.transactionId,
    decisionId: saved.decisionId,
  });
  const edited = after.decisions[0];
  expect(edited).toMatchObject({
    id: before.id,
    createdAt: before.createdAt,
    stockId: before.stockId,
    transcript: before.transcript,
    followUpAnswer: before.followUpAnswer,
    type: "add",
    rawInput: "編集後の判断",
    decidedAt: "2026-01-02",
    reviewConditions: ["条件1", "条件2"],
  });
  expect(edited.reviewDates).toEqual([
    "2026-02-01T12:00:00.000Z",
    "2026-03-01T12:00:00.000Z",
  ]);
  expect(edited.editHistory).toHaveLength(1);
  expect(edited.editHistory?.[0].previous).toMatchObject({
    rawInput: original.rawInput,
    thesis: original.thesis,
    decidedAt: original.decidedAt,
  });
  expect(edited.editHistory?.[0].previous).not.toHaveProperty("editHistory");
  await expect(
    actions.editDecisionAction({
      ...edited,
      expectedRevision: 0,
      thesis: "古い画面からの修正",
    }),
  ).rejects.toThrow("別の画面");
  const { GET } = await import("@/app/api/export/route");
  const exported = await (await GET()).json();
  expect(exported.decisions[0].editHistory).toEqual(edited.editHistory);
  await actions.editDecisionAction({
    ...edited,
    expectedRevision: 1,
    thesis: "2回目の修正",
    reviewDates: [],
  });
  const final = (
    await actions.getStockTimelineAction({ stockId: saved.stockId })
  ).decisions[0];
  expect(final.editHistory).toHaveLength(2);
  expect(final.editHistory?.[1].previous.thesis).toBe("修正した仮説");
  expect(final.reviewAt).toBeNull();
});

it("rejects stale edits, missing decisions, other stocks, blank text and invalid dates without changes", async () => {
  const saved = await actions.saveDecisionAction({
    ...original,
    stock: { ...original.stock, name: "架空競合社" },
    transaction: null,
  });
  const before = (
    await actions.getStockTimelineAction({ stockId: saved.stockId })
  ).decisions[0];
  const edit = {
    ...before,
    decidedAt: "2026-01-01",
    reviewDates: [],
    expectedRevision: 0,
  };
  await expect(
    actions.editDecisionAction({ ...edit, expectedRevision: 1 }),
  ).rejects.toThrow("別の画面");
  await expect(
    actions.editDecisionAction({ ...edit, id: "missing" }),
  ).rejects.toThrow("見つかりません");
  await expect(
    actions.editDecisionAction({ ...edit, stockId: "other" }),
  ).rejects.toThrow("見つかりません");
  await expect(
    actions.editDecisionAction({ ...edit, rawInput: " \n " }),
  ).rejects.toThrow();
  await expect(
    actions.editDecisionAction({ ...edit, decidedAt: "2026-02-30" }),
  ).rejects.toThrow();
  expect(
    (await actions.getStockTimelineAction({ stockId: saved.stockId }))
      .decisions[0],
  ).toEqual(before);
});
