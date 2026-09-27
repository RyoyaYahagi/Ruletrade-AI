import { describe, expect, it } from "vitest";

import { DecisionExtractionSchema } from "@/schemas/decision";

describe("DecisionExtractionSchema", () => {
  it("accepts a completed trade with unknown price and one optional question", () => {
    const parsed = DecisionExtractionSchema.parse({
      type: "buy",
      stock: { ticker: null, name: "キオクシア", market: null },
      thesis: "AI向けNAND需要の成長を期待",
      assumptions: ["データセンター需要が続く"],
      reviewConditions: ["データセンター需要の鈍化"],
      addConditions: [],
      transaction: {
        side: "buy",
        quantity: 100,
        price: null,
        fee: null,
        executedAt: null,
      },
      followUpQuestion: "何が起きたら考えを見直しますか？",
    });

    expect(parsed.transaction?.price).toBeNull();
    expect(parsed.followUpQuestion).toBe("何が起きたら考えを見直しますか？");
  });

  it("rejects a blank ticker instead of converting it into a missing value", () => {
    expect(() =>
      DecisionExtractionSchema.parse({
        type: "note",
        stock: { ticker: "", name: "ソニー", market: null },
        thesis: null,
        assumptions: [],
        reviewConditions: [],
        addConditions: [],
        transaction: null,
        followUpQuestion: null,
      }),
    ).toThrow();
  });
});
