import { describe, expect, it } from "vitest";

import {
  decisionDraftSchema,
  decisionInputSchema,
  reviewComparisonSchema,
  transactionInputSchema,
} from "../src/lib/domain";

describe("decision schemas", () => {
  it("allows AI draft without a ticker so the user can fill it in", () => {
    const parsed = decisionDraftSchema.parse({
      ticker: null,
      companyName: "JX金属",
      kind: "buy",
      rawText: "JX金属を買った",
      thesis: "データセンター需要を期待",
      assumptions: [],
      exitConditions: [],
      addConditions: [],
    });

    expect(parsed.ticker).toBeNull();
  });

  it("requires a ticker before persistence", () => {
    const result = decisionInputSchema.safeParse({
      ticker: "",
      companyName: "JX金属",
      kind: "buy",
      rawText: "JX金属を買った",
      thesis: null,
      assumptions: [],
      exitConditions: [],
      addConditions: [],
      reviewAt: null,
    });

    expect(result.success).toBe(false);
  });
});

describe("transaction schema", () => {
  it("rejects non-positive quantities", () => {
    const result = transactionInputSchema.safeParse({
      stockId: "56e8fa1d-3b13-4609-8ce7-c780f7937394",
      side: "buy",
      tradedAt: "2026-09-26",
      quantity: 0,
      price: 1000,
      fees: 0,
      reflection: null,
    });

    expect(result.success).toBe(false);
  });
});

describe("review comparison schema", () => {
  it("keeps self-review structured without an action recommendation", () => {
    const parsed = reviewComparisonSchema.parse({
      summary: "購入時と比べ、需要への見方は同じです。",
      unchanged: ["需要への期待"],
      changed: [],
      unclear: ["価格下落をどう捉えるかは記録だけでは不明"],
      question: "購入時の前提そのものに変化はありますか？",
    });

    expect(parsed.changed).toEqual([]);
    expect(parsed.question).toContain("前提");
  });
});
