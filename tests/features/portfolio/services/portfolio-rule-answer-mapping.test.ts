import { describe, expect, it } from "vitest";
import { buildDraftFromAnswers } from "@/features/portfolio/services/portfolio-rule-answer-mapping";
import type { PortfolioRuleGuidanceAnswer } from "@/schemas/portfolio/portfolio-rule-guidance-schema";

function answer(
  key: string,
  value: string,
  overrides: Partial<PortfolioRuleGuidanceAnswer> = {},
): PortfolioRuleGuidanceAnswer {
  return {
    key,
    question: `${key}の質問`,
    answer: `${key}の回答`,
    value,
    ...overrides,
  };
}

describe("buildDraftFromAnswers", () => {
  it("returns an empty draft with no undecided keys for no answers", () => {
    const result = buildDraftFromAnswers([]);

    expect(result.draft).toEqual({});
    expect(result.undecidedKeys).toEqual([]);
  });

  it("maps risk_tolerance directly", () => {
    const result = buildDraftFromAnswers([answer("risk_tolerance", "balanced")]);

    expect(result.draft.riskTolerance).toBe("balanced");
    expect(result.undecidedKeys).toEqual([]);
  });

  it("marks risk_tolerance as undecided", () => {
    const result = buildDraftFromAnswers([
      answer("risk_tolerance", "undecided"),
    ]);

    expect(result.draft.riskTolerance).toBeUndefined();
    expect(result.undecidedKeys).toEqual(["risk_tolerance"]);
  });

  it("maps max_position_count as a number", () => {
    const result = buildDraftFromAnswers([answer("max_position_count", "10")]);

    expect(result.draft.maxPositionCount).toBe(10);
  });

  it("maps max_position_percent, including the 30plus case", () => {
    const result = buildDraftFromAnswers([
      answer("max_position_percent", "30plus"),
    ]);

    expect(result.draft.maxPositionPercent).toBe(30);
  });

  it("maps group_concentration to both sector and theme percent, including 50plus", () => {
    const result = buildDraftFromAnswers([
      answer("group_concentration", "50plus"),
    ]);

    expect(result.draft.maxSectorPercent).toBe(50);
    expect(result.draft.maxThemePercent).toBe(50);
  });

  it("treats max_market_percent no_limit as a decision, not undecided", () => {
    const result = buildDraftFromAnswers([
      answer("max_market_percent", "no_limit"),
    ]);

    expect(result.draft.maxMarketPercent).toBeUndefined();
    expect(result.undecidedKeys).toEqual([]);
  });

  it("maps max_market_percent numeric values", () => {
    const result = buildDraftFromAnswers([answer("max_market_percent", "70")]);

    expect(result.draft.maxMarketPercent).toBe(70);
  });

  it("treats min_cash_percent minimal as a decision, not undecided", () => {
    const result = buildDraftFromAnswers([
      answer("min_cash_percent", "minimal"),
    ]);

    expect(result.draft.minCashPercent).toBeUndefined();
    expect(result.undecidedKeys).toEqual([]);
  });

  it("maps min_cash_percent numeric values", () => {
    const result = buildDraftFromAnswers([answer("min_cash_percent", "30")]);

    expect(result.draft.minCashPercent).toBe(30);
  });

  it("treats core_satellite no_fund as a decision, not undecided", () => {
    const result = buildDraftFromAnswers([
      answer("core_satellite", "no_fund"),
    ]);

    expect(result.draft.targetAllocations).toBeUndefined();
    expect(result.undecidedKeys).toEqual([]);
  });

  it("maps core_satellite numeric values to targetAllocations", () => {
    const result = buildDraftFromAnswers([answer("core_satellite", "25")]);

    expect(result.draft.targetAllocations).toEqual([
      { key: "stock", targetPercent: 25, tolerancePercent: 5 },
    ]);
  });

  it("splits excluded_asset_types into an array", () => {
    const result = buildDraftFromAnswers([
      answer("excluded_asset_types", "レバレッジ型商品,暗号資産", {
        answer: "レバレッジ型商品、暗号資産",
      }),
    ]);

    expect(result.draft.excludedAssetTypes).toEqual([
      "レバレッジ型商品",
      "暗号資産",
    ]);
  });

  it("maps excluded_asset_types none to an empty array", () => {
    const result = buildDraftFromAnswers([
      answer("excluded_asset_types", "none"),
    ]);

    expect(result.draft.excludedAssetTypes).toEqual([]);
  });

  it("maps max_single_trade_loss_percent", () => {
    const result = buildDraftFromAnswers([
      answer("max_single_trade_loss_percent", "0.5"),
    ]);

    expect(result.draft.maxSingleTradeLossPercent).toBe(0.5);
  });

  it("treats free_text answers as undecided regardless of key", () => {
    const result = buildDraftFromAnswers([
      answer("max_single_trade_loss_percent", "free_text", {
        answer: "まだ迷っています",
      }),
    ]);

    expect(result.draft.maxSingleTradeLossPercent).toBeUndefined();
    expect(result.undecidedKeys).toEqual(["max_single_trade_loss_percent"]);
  });

  it("builds a full draft from a complete set of decisive answers", () => {
    const result = buildDraftFromAnswers([
      answer("risk_tolerance", "conservative"),
      answer("max_position_count", "5"),
      answer("max_position_percent", "10"),
      answer("group_concentration", "20"),
      answer("max_market_percent", "50"),
      answer("min_cash_percent", "30"),
      answer("core_satellite", "10"),
      answer("excluded_asset_types", "暗号資産"),
      answer("max_single_trade_loss_percent", "0.5"),
    ]);

    expect(result.undecidedKeys).toEqual([]);
    expect(result.draft).toEqual({
      riskTolerance: "conservative",
      maxPositionCount: 5,
      maxPositionPercent: 10,
      maxSectorPercent: 20,
      maxThemePercent: 20,
      maxMarketPercent: 50,
      minCashPercent: 30,
      targetAllocations: [
        { key: "stock", targetPercent: 10, tolerancePercent: 5 },
      ],
      excludedAssetTypes: ["暗号資産"],
      maxSingleTradeLossPercent: 0.5,
    });
  });
});
