import { describe, expect, it } from "vitest";
import { detectProhibitedPhrases } from "@/lib/safety/detect-prohibited-phrases";

describe("detectProhibitedPhrases", () => {
  it("detects buy recommendation", () => {
    const result = detectProhibitedPhrases("この銘柄は買うべきです。");
    expect(result.some((item) => item.type === "buy_recommendation")).toBe(
      true
    );
  });

  it("detects sell recommendation", () => {
    const result = detectProhibitedPhrases("今すぐ売るべきです。");
    expect(result.some((item) => item.type === "sell_recommendation")).toBe(
      true
    );
  });

  it("detects price prediction", () => {
    const result = detectProhibitedPhrases("この株価は必ず上がります。");
    expect(result.some((item) => item.type === "price_prediction")).toBe(true);
  });

  it("detects profit guarantee", () => {
    const result = detectProhibitedPhrases("利益が出ます。儲かります。");
    expect(result.some((item) => item.type === "profit_guarantee")).toBe(true);
  });

  it("detects loss avoidance guarantee", () => {
    const result = detectProhibitedPhrases("損しません。安全です。");
    expect(
      result.some((item) => item.type === "loss_avoidance_guarantee")
    ).toBe(true);
  });

  it("detects decision delegation", () => {
    const result = detectProhibitedPhrases("この条件なら購入決定でよいです。");
    expect(result.some((item) => item.type === "decision_delegation")).toBe(
      true
    );
  });

  it("detects urgency pressure", () => {
    const result = detectProhibitedPhrases(
      "今すぐ判断しないとチャンスを逃します。"
    );
    expect(result.some((item) => item.type === "urgency_pressure")).toBe(true);
  });

  it("detects fear mongering", () => {
    const result = detectProhibitedPhrases("手遅れになります。大損します。");
    expect(result.some((item) => item.type === "fear_mongering")).toBe(true);
  });

  it("detects privacy risk", () => {
    const result = detectProhibitedPhrases(
      "証券口座のパスワードを入力してください。"
    );
    expect(result.some((item) => item.type === "privacy_risk")).toBe(true);
  });

  it("passes neutral rule review text", () => {
    const result = detectProhibitedPhrases(
      "損切り条件がまだ明確ではありません。どの条件で投資仮説を見直すか決めておくと、ルールがより明確になります。"
    );
    expect(result).toHaveLength(0);
  });

  it("passes safe urgency wording in neutral context", () => {
    const result = detectProhibitedPhrases("保存済みルールを確認しましょう。");
    expect(result).toHaveLength(0);
  });

  it("passes safe help text about stop loss", () => {
    const result = detectProhibitedPhrases("損切り条件を事前に決めましょう。");
    expect(result).toHaveLength(0);
  });
});
