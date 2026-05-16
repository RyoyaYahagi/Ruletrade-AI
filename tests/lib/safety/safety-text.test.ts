import { describe, expect, it } from "vitest";
import { buildRuleReviewSafetyText } from "@/lib/safety/safety-text";
import type { RuleReviewOutput } from "@/schemas/rules/rule-review-schema";

describe("buildRuleReviewSafetyText", () => {
  it("builds text from summary only", () => {
    const review = {
      summary: "これは概要です。",
      qualityChecks: [],
      nextQuestions: [],
    } as RuleReviewOutput;
    const result = buildRuleReviewSafetyText(review);
    expect(result).toBe("これは概要です。");
  });

  it("includes qualityChecks label, reason and suggestedQuestion", () => {
    const review = {
      summary: "概要",
      qualityChecks: [
        { label: "チェック1", reason: "理由1", suggestedQuestion: "質問1" },
        { label: "チェック2", reason: "理由2" },
      ],
      nextQuestions: [],
    } as RuleReviewOutput;
    const result = buildRuleReviewSafetyText(review);
    expect(result).toBe("概要\nチェック1\n理由1\n質問1\nチェック2\n理由2");
  });

  it("includes nextQuestions questionText and helpText", () => {
    const review = {
      summary: "概要",
      qualityChecks: [],
      nextQuestions: [
        { questionText: "Q1", helpText: "H1" },
        { questionText: "Q2" },
      ],
    } as RuleReviewOutput;
    const result = buildRuleReviewSafetyText(review);
    expect(result).toBe("概要\nQ1\nH1\nQ2");
  });

  it("filters out non-object suggestedRuleUpdates", () => {
    const review = {
      summary: "概要",
      qualityChecks: [],
      nextQuestions: [],
      suggestedRuleUpdates: [
        null,
        "invalid",
        { reason: "更新理由" },
        { notReason: "skip" },
      ],
    } as RuleReviewOutput;
    const result = buildRuleReviewSafetyText(review);
    expect(result).toBe("概要\n更新理由");
  });

  it("filters out suggestedRuleUpdates missing reason string", () => {
    const review = {
      summary: "概要",
      qualityChecks: [],
      nextQuestions: [],
      suggestedRuleUpdates: [{ reason: 123 }, { reason: "有効" }],
    } as RuleReviewOutput;
    const result = buildRuleReviewSafetyText(review);
    expect(result).toBe("概要\n有効");
  });

  it("handles empty suggestedRuleUpdates array", () => {
    const review = {
      summary: "概要",
      qualityChecks: [],
      nextQuestions: [],
      suggestedRuleUpdates: [],
    } as RuleReviewOutput;
    const result = buildRuleReviewSafetyText(review);
    expect(result).toBe("概要");
  });

  it("filters falsy parts", () => {
    const review = {
      summary: "",
      qualityChecks: [{ label: "", reason: "理由", suggestedQuestion: "" }],
      nextQuestions: [],
    } as RuleReviewOutput;
    const result = buildRuleReviewSafetyText(review);
    expect(result).toBe("理由");
  });
});
