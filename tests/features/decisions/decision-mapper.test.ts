import { describe, expect, it } from "vitest";

import { mapDecisionRow } from "@/features/decisions/decision-mapper";
import { decisionDisplayText } from "@/features/decisions/decision-display";

describe("mapDecisionRow", () => {
  it("decodes structured fields without changing the source input or transcript", () => {
    const rawInput = "  キオクシアを100株買った。\nAI向け需要に期待している。  ";
    const transcript = "キオクシアを100株買った。 AI向け需要に期待している。";
    const mapped = mapDecisionRow({
      id: "decision-1",
      stockId: "stock-1",
      type: "buy",
      rawInput,
      transcript,
      followUpAnswer: null,
      thesis: "AI向け需要への期待",
      assumptions: '["需要が続く"]',
      reviewConditions: '["需要が鈍る"]',
      addConditions: "[]",
      reviewAt: null,
      createdAt: "2026-09-26T01:00:00.000Z",
    });

    expect(mapped.rawInput).toBe(rawInput);
    expect(mapped.transcript).toBe(transcript);
    expect(mapped.assumptions).toEqual(["需要が続く"]);
    expect(mapped.reviewConditions).toEqual(["需要が鈍る"]);
    expect(decisionDisplayText(mapped)).toBe("AI向け需要への期待");
  });

  it("uses original input when neither new nor legacy summary exists", () => {
    expect(
      decisionDisplayText({ summary: null, thesis: null, rawInput: "元の発言" }),
    ).toBe("元の発言");
  });

  it("fails explicitly for corrupt persisted structured data", () => {
    expect(() =>
      mapDecisionRow({
        id: "decision-1",
        stockId: "stock-1",
        type: "buy",
        rawInput: "original",
        transcript: null,
        followUpAnswer: null,
        thesis: null,
        assumptions: "not-json",
        reviewConditions: "[]",
        addConditions: "[]",
        reviewAt: null,
        createdAt: "2026-09-26T01:00:00.000Z",
      }),
    ).toThrow();
  });
});
