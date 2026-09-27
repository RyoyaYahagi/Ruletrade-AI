import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { mapDecisionRow } from "@/features/decisions/decision-mapper";

const directory = mkdtempSync(
  path.join(os.tmpdir(), "ruletrade-review-dates-"),
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
const input = {
  type: "note",
  stock: { name: "架空予定社", ticker: null, market: null },
  rawInput: "複数回振り返る",
  thesis: null,
  assumptions: [],
  reviewConditions: [],
  addConditions: [],
  followUpQuestion: null,
  transaction: null,
};
const first = "2026-01-01T12:00:00.000Z";
const second = "2026-02-01T12:00:00.000Z";

it("persists sorted distinct schedules and keeps the next reminder after a review", async () => {
  const saved = await actions.saveDecisionAction({
    ...input,
    reviewDates: [second, first, first],
  });
  const timeline = await actions.getStockTimelineAction({
    stockId: saved.stockId,
  });
  expect(timeline.decisions[0]).toMatchObject({
    reviewAt: first,
    reviewDates: [first, second],
  });
  expect(
    await actions.listReviewsDueAction("2025-12-31T23:59:59.000Z"),
  ).toEqual([]);
  expect((await actions.listReviewsDueAction(first))[0].decision.reviewAt).toBe(
    first,
  );
  vi.useFakeTimers();
  try {
    vi.setSystemTime("2026-01-10T00:00:00.000Z");
    await actions.saveReviewAction({
      stockId: saved.stockId,
      decisionId: saved.decisionId,
      currentInput: "1回目の振り返り",
      summary: "事業の進捗を確認",
      differences: [],
      reflection: "需要の継続を確認した。",
    });
    expect(
      await actions.listReviewsDueAction("2026-01-31T23:59:59.000Z"),
    ).toEqual([]);
    const due = await actions.listReviewsDueAction(second);
    expect(due).toHaveLength(1);
    expect(due[0].decision.reviewAt).toBe(second);
    vi.setSystemTime("2026-02-10T00:00:00.000Z");
    await actions.saveReviewAction({
      stockId: saved.stockId,
      decisionId: saved.decisionId,
      currentInput: "2回目の振り返り",
      summary: "事業の進捗を再確認",
      differences: [],
      reflection: "前提を再確認した。",
    });
    expect(
      await actions.listReviewsDueAction("2026-03-01T00:00:00.000Z"),
    ).toEqual([]);
  } finally {
    vi.useRealTimers();
  }
});

it("supports legacy reviewAt and explicit empty schedules", async () => {
  const saved = await actions.saveDecisionAction({ ...input, reviewAt: first });
  expect(
    (
      await actions.getStockTimelineAction({ stockId: saved.stockId })
    ).decisions.at(-1)?.reviewDates,
  ).toEqual([first]);
  const none = await actions.saveDecisionAction({
    ...input,
    reviewAt: first,
    reviewDates: [],
  });
  const timeline = await actions.getStockTimelineAction({
    stockId: saved.stockId,
  });
  expect(
    timeline.decisions.find((decision) => decision.id === none.decisionId),
  ).toMatchObject({ reviewAt: null, reviewDates: [] });
});

it("rejects invalid schedule dates without creating a record", async () => {
  const before = await actions.listStocksAction();
  await expect(
    actions.saveDecisionAction({ ...input, reviewDates: ["invalid"] }),
  ).rejects.toThrow();
  expect(await actions.listStocksAction()).toEqual(before);
});

it("uses the legacy review date when the JSON schedule column is missing or null", () => {
  const row = {
    id: "legacy",
    stockId: "stock",
    type: "note",
    rawInput: "旧記録",
    transcript: null,
    followUpAnswer: null,
    thesis: null,
    assumptions: "[]",
    reviewConditions: "[]",
    addConditions: "[]",
    reviewAt: first,
    createdAt: first,
  };
  expect(mapDecisionRow(row).reviewDates).toEqual([first]);
  expect(mapDecisionRow({ ...row, reviewDates: null }).reviewDates).toEqual([
    first,
  ]);
});
