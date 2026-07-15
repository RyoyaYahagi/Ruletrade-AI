import { describe, expect, it } from "vitest";
import { detectProhibitedPhrases } from "@/lib/safety/detect-prohibited-phrases";

describe("detectProhibitedPhrases", () => {
  it("detects buy recommendation", () => {
    const result = detectProhibitedPhrases("買うべきです");
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].type).toBe("buy_recommendation");
  });

  it("detects sell recommendation", () => {
    const result = detectProhibitedPhrases("売るべきです");
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].type).toBe("sell_recommendation");
  });

  it("returns empty for safe text", () => {
    const result = detectProhibitedPhrases("ルールの確認をしましょう");
    expect(result).toHaveLength(0);
  });
});
