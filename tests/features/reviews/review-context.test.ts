import { describe, expect, it } from "vitest";
import { buildComparisonContext } from "@/features/reviews/review-context";
import type { Decision } from "@/schemas/decision";

describe("buildComparisonContext", () => {
  it("keeps source, summary, points, type, and date for comparison", () => {
    const decisions: Decision[] = [{
      id: "first", stockId: "stock-1", type: "buy",
      rawInput: "AI需要が続くと期待して購入した。", transcript: null,
      followUpAnswer: "次の決算を見る。", followUpQuestion: "何を見ますか？",
      summary: "AI需要の継続を期待して購入した。",
      points: [{ kind: "expectation", text: "AI需要が続くと期待", source: "raw_input" }],
      thesis: null, assumptions: [], reviewConditions: [], addConditions: [],
      reviewAt: null, decidedAt: "2026-01-01", createdAt: "2026-01-01T00:00:00.000Z",
    }];
    expect(buildComparisonContext(decisions)).toEqual([{
      id: "first", createdAt: "2026-01-01T00:00:00.000Z", decidedAt: "2026-01-01",
      type: "buy", rawInput: "AI需要が続くと期待して購入した。",
      summary: "AI需要の継続を期待して購入した。",
      points: [{ kind: "expectation", text: "AI需要が続くと期待", source: "raw_input" }],
    }]);
  });
});
