import { describe, expect, it } from "vitest";
import {
  PortfolioRuleGuidanceRequestSchema,
  PortfolioRuleGuidanceResponseSchema,
} from "@/schemas/portfolio/portfolio-rule-guidance-schema";

describe("PortfolioRuleGuidanceSchema", () => {
  it("defaults an empty guidance request", () => {
    const result = PortfolioRuleGuidanceRequestSchema.safeParse({});

    expect(result.success).toBe(true);
    expect(result.data?.history).toEqual([]);
    expect(result.data?.draft).toEqual({});
  });

  it("accepts a structured guidance response", () => {
    const result = PortfolioRuleGuidanceResponseSchema.safeParse({
      message: "目的を整理します。",
      question: {
        key: "purpose",
        text: "このポートフォリオの目的は何ですか？",
      },
      suggestion: { maxPositionPercent: 10 },
      progress: 25,
      readyToReview: false,
      guidance: ["目的", "資金の使う時期"],
      disclaimer: "これは投資助言ではありません。",
    });

    expect(result.success).toBe(true);
    expect(result.data?.suggestion.maxPositionPercent).toBe(10);
  });

  it("rejects a guidance response with an invalid percentage", () => {
    const result = PortfolioRuleGuidanceResponseSchema.safeParse({
      message: "説明",
      question: null,
      suggestion: { minCashPercent: 101 },
      progress: 100,
      readyToReview: true,
      disclaimer: "これは投資助言ではありません。",
    });

    expect(result.success).toBe(false);
  });
});
