import { describe, expect, it } from "vitest";
import {
  PortfolioRuleGuidanceRequestSchema,
  PortfolioRuleGuidanceResponseSchema,
} from "@/schemas/portfolio/portfolio-rule-guidance-schema";

describe("PortfolioRuleGuidanceSchema", () => {
  it("defaults an empty guidance request", () => {
    const result = PortfolioRuleGuidanceRequestSchema.safeParse({});

    expect(result.success).toBe(true);
    expect(result.data?.answers).toEqual([]);
    expect(result.data?.draft).toEqual({});
  });

  it("accepts fixed-question answers", () => {
    const result = PortfolioRuleGuidanceRequestSchema.safeParse({
      answers: [
        {
          key: "risk_tolerance",
          question: "資産全体が2割下がったとき、あなたの気持ちに一番近いのは？",
          answer: "前提が変わらなければ持ち続けられそう",
          value: "balanced",
        },
      ],
      draft: { maxPositionPercent: 10 },
    });

    expect(result.success).toBe(true);
    expect(result.data?.answers[0]?.key).toBe("risk_tolerance");
    expect(result.data?.answers[0]?.value).toBe("balanced");
  });

  it("rejects an answer without a question text", () => {
    const result = PortfolioRuleGuidanceRequestSchema.safeParse({
      answers: [
        { key: "risk_tolerance", answer: "持ち続けられそう", value: "balanced" },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects an answer without a value", () => {
    const result = PortfolioRuleGuidanceRequestSchema.safeParse({
      answers: [
        {
          key: "risk_tolerance",
          question: "資産全体が2割下がったとき、あなたの気持ちに一番近いのは？",
          answer: "持ち続けられそう",
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("accepts a structured guidance response", () => {
    const result = PortfolioRuleGuidanceResponseSchema.safeParse({
      message: "目的を整理します。",
      question: {
        key: "purpose",
        text: "このポートフォリオの目的は何ですか？",
        explanation: "目的により考える項目が変わります。",
      },
      suggestions: [
        {
          key: "balanced",
          title: "中間の案",
          summary: "バランスを取る参考案です。",
          tradeoff: "両方の妥協が必要です。",
          draft: { maxPositionPercent: 10 },
        },
      ],
      progress: 25,
      readyToReview: false,
      guidance: ["目的", "資金の使う時期"],
      disclaimer: "これは投資助言ではありません。",
    });

    expect(result.success).toBe(true);
    expect(result.data?.suggestions[0]?.draft.maxPositionPercent).toBe(10);
    expect(result.data?.consistencyNotes).toEqual([]);
  });

  it("accepts consistency notes in the guidance response", () => {
    const result = PortfolioRuleGuidanceResponseSchema.safeParse({
      message: "回答を確認しました。",
      question: null,
      suggestions: [],
      consistencyNotes: ["回答間に注意したい点があります。"],
      progress: 100,
      readyToReview: true,
      guidance: [],
      disclaimer: "これは投資助言ではありません。",
    });

    expect(result.success).toBe(true);
    expect(result.data?.consistencyNotes).toEqual([
      "回答間に注意したい点があります。",
    ]);
  });

  it("rejects a guidance response with an invalid percentage", () => {
    const result = PortfolioRuleGuidanceResponseSchema.safeParse({
      message: "説明",
      question: null,
      suggestions: [
        {
          key: "invalid",
          title: "不正な案",
          summary: "説明",
          tradeoff: "トレードオフ",
          draft: { minCashPercent: 101 },
        },
      ],
      progress: 100,
      readyToReview: true,
      disclaimer: "これは投資助言ではありません。",
    });

    expect(result.success).toBe(false);
  });
});
