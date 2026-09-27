import { describe, expect, it } from "vitest";

import { buildComparisonContext } from "@/features/reviews/review-context";

import type { Decision } from "@/schemas/decision";

describe("buildComparisonContext", () => {
  it("keeps all history entries and their original reasons in chronological input order", () => {
    const decisions: Decision[] = [
      {
        id: "first",
        stockId: "stock-1",
        type: "buy",
        rawInput: "最初はデータセンター需要を期待した。",
        transcript: null,
        followUpAnswer: null,
        thesis: "データセンター需要への期待",
        assumptions: ["需要が続く"],
        reviewConditions: ["需要の鈍化"],
        addConditions: [],
        reviewAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "later",
        stockId: "stock-1",
        type: "note",
        rawInput: "株価が下がって気になっている。",
        transcript: null,
        followUpAnswer: null,
        thesis: null,
        assumptions: [],
        reviewConditions: [],
        addConditions: [],
        reviewAt: null,
        createdAt: "2026-01-02T00:00:00.000Z",
      },
    ];

    expect(buildComparisonContext(decisions)).toEqual([
      {
        createdAt: "2026-01-01T00:00:00.000Z",
        type: "buy",
        rawInput: "最初はデータセンター需要を期待した。",
        thesis: "データセンター需要への期待",
        assumptions: ["需要が続く"],
        reviewConditions: ["需要の鈍化"],
        addConditions: [],
      },
      {
        createdAt: "2026-01-02T00:00:00.000Z",
        type: "note",
        rawInput: "株価が下がって気になっている。",
        thesis: null,
        assumptions: [],
        reviewConditions: [],
        addConditions: [],
      },
    ]);
  });
});
