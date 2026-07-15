import { describe, expect, it } from "vitest";
import {
  evaluatePortfolioCompliance,
  simulatePositionImpact,
} from "@/features/portfolio/services/portfolio-compliance-service";
import { PortfolioCommonRuleSchema } from "@/schemas/portfolio/portfolio-rule-schema";

function buildRule(input: Record<string, unknown>) {
  const parsed = PortfolioCommonRuleSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid rule fixture");
  return parsed.data;
}

describe("evaluatePortfolioCompliance", () => {
  it("returns no violations when no rule is configured", () => {
    const result = evaluatePortfolioCompliance({
      rule: null,
      cashAmount: 100,
      positions: [{ ticker: "5803", market_value: 900 }],
    });

    expect(result.totalValue).toBe(1000);
    expect(result.cashPercent).toBe(10);
    expect(result.violations).toEqual([]);
  });

  it("detects a single position exceeding maxPositionPercent", () => {
    const rule = buildRule({ maxPositionPercent: 10 });

    const result = evaluatePortfolioCompliance({
      rule,
      cashAmount: 500,
      positions: [
        { ticker: "5803", market_value: 200 },
        { ticker: "6758", market_value: 300 },
      ],
    });

    const violation = result.violations.find(
      (v) => v.ruleKey === "max_position_percent" && v.subject === "5803",
    );
    expect(violation).toBeDefined();
    expect(violation?.actualPercent).toBe(20);
    expect(violation?.severity).toBe("high");

    const sonyViolation = result.violations.find((v) => v.subject === "6758");
    expect(sonyViolation?.actualPercent).toBe(30);
  });

  it("excludes fund and etf positions from maxPositionPercent concentration checks", () => {
    const rule = buildRule({ maxPositionPercent: 10 });

    const result = evaluatePortfolioCompliance({
      rule,
      cashAmount: 100,
      positions: [
        { ticker: "ORACLE", market_value: 400, asset_type: "fund" },
        { ticker: "VOO", market_value: 400, asset_type: "etf" },
        { ticker: "5803", market_value: 100, asset_type: "stock" },
      ],
    });

    expect(
      result.violations.find((v) => v.subject === "ORACLE"),
    ).toBeUndefined();
    expect(result.violations.find((v) => v.subject === "VOO")).toBeUndefined();
  });

  it("still flags individual stocks exceeding maxPositionPercent alongside funds", () => {
    const rule = buildRule({ maxPositionPercent: 10 });

    const result = evaluatePortfolioCompliance({
      rule,
      cashAmount: 100,
      positions: [
        { ticker: "ORACLE", market_value: 400, asset_type: "fund" },
        { ticker: "5803", market_value: 200, asset_type: "stock" },
      ],
    });

    const violation = result.violations.find((v) => v.subject === "5803");
    expect(violation).toBeDefined();
    expect(violation?.actualPercent).toBe(28.57);
  });

  it("counts fund/etf positions toward maxPositionCount but excludes them from maxMarketPercent", () => {
    const rule = buildRule({ maxPositionCount: 1, maxMarketPercent: 10 });

    const result = evaluatePortfolioCompliance({
      rule,
      cashAmount: 100,
      positions: [
        { ticker: "ORACLE", market_value: 800, asset_type: "fund", market: "JP" },
        { ticker: "VOO", market_value: 100, asset_type: "etf", market: "JP" },
        { ticker: "5803", market_value: 100, asset_type: "stock", market: "US" },
      ],
    });

    expect(
      result.violations.find((v) => v.ruleKey === "max_position_count"),
    ).toBeDefined();
    expect(result.violations.find((v) => v.ruleKey === "max_market_percent")).toBeUndefined();
  });

  it("aggregates multiple positions with the same ticker", () => {
    const rule = buildRule({ maxPositionPercent: 15 });

    const result = evaluatePortfolioCompliance({
      rule,
      cashAmount: 800,
      positions: [
        { ticker: "5803", market_value: 100 },
        { ticker: "5803", market_value: 100 },
      ],
    });

    const violation = result.violations.find((v) => v.subject === "5803");
    expect(violation?.actualPercent).toBe(20);
  });

  it("detects theme concentration across different tickers", () => {
    const rule = buildRule({ maxThemePercent: 30 });

    const result = evaluatePortfolioCompliance({
      rule,
      cashAmount: 600,
      positions: [
        { ticker: "5803", market_value: 200, theme: "データセンター" },
        { ticker: "5801", market_value: 200, theme: "データセンター" },
      ],
    });

    const violation = result.violations.find(
      (v) => v.ruleKey === "max_theme_percent",
    );
    expect(violation?.subject).toBe("データセンター");
    expect(violation?.actualPercent).toBe(40);
  });

  it("detects too many positions for maxPositionCount", () => {
    const rule = buildRule({ maxPositionCount: 2 });

    const result = evaluatePortfolioCompliance({
      rule,
      cashAmount: 100,
      positions: [
        { ticker: "5803", market_value: 100 },
        { ticker: "5803", market_value: 100 },
        { ticker: "6758", market_value: 100 },
        { ticker: "7203", market_value: 100 },
      ],
    });

    const violation = result.violations.find(
      (v) => v.ruleKey === "max_position_count",
    );
    expect(violation).toBeDefined();
    expect(violation?.limitPercent).toBe(2);
    expect(violation?.actualPercent).toBe(3);
  });

  it("counts the same ticker once for maxPositionCount", () => {
    const rule = buildRule({ maxPositionCount: 2 });

    const result = evaluatePortfolioCompliance({
      rule,
      cashAmount: 100,
      positions: [
        { ticker: "5803", market_value: 100 },
        { ticker: "5803", market_value: 100 },
      ],
    });

    expect(result.violations).toEqual([]);
  });

  it("detects market concentration beyond maxMarketPercent", () => {
    const rule = buildRule({ maxMarketPercent: 50 });

    const result = evaluatePortfolioCompliance({
      rule,
      cashAmount: 200,
      positions: [
        { ticker: "AAPL", market_value: 400, market: "US", asset_type: "stock" },
        { ticker: "MSFT", market_value: 200, market: "US", asset_type: "stock" },
        { ticker: "5803", market_value: 200, market: "JP", asset_type: "stock" },
      ],
    });

    const violation = result.violations.find(
      (v) => v.ruleKey === "max_market_percent",
    );
    expect(violation?.subject).toBe("US");
    expect(violation?.actualPercent).toBe(60);
  });

  it("flags holdings of an excluded asset type", () => {
    const rule = buildRule({ excludedAssetTypes: ["暗号資産"] });

    const result = evaluatePortfolioCompliance({
      rule,
      cashAmount: 500,
      positions: [
        { ticker: "BTC", market_value: 500, asset_type: "暗号資産" },
      ],
    });

    const violation = result.violations.find(
      (v) => v.ruleKey === "excluded_asset_type",
    );
    expect(violation?.subject).toBe("暗号資産");
    expect(violation?.severity).toBe("high");
    expect(violation?.actualPercent).toBe(50);
  });

  it("stays quiet when no excluded asset type is held", () => {
    const rule = buildRule({ excludedAssetTypes: ["暗号資産"] });

    const result = evaluatePortfolioCompliance({
      rule,
      cashAmount: 500,
      positions: [{ ticker: "5803", market_value: 500, asset_type: "stock" }],
    });

    expect(result.violations).toEqual([]);
  });

  it("detects cash below minCashPercent", () => {
    const rule = buildRule({ minCashPercent: 20 });

    const result = evaluatePortfolioCompliance({
      rule,
      cashAmount: 100,
      positions: [{ ticker: "5803", market_value: 900 }],
    });

    const violation = result.violations.find(
      (v) => v.ruleKey === "min_cash_percent",
    );
    expect(violation).toBeDefined();
    expect(violation?.actualPercent).toBe(10);
  });

  it("detects target allocation drift beyond tolerance", () => {
    const rule = buildRule({
      targetAllocations: [
        { key: "stock", targetPercent: 50, tolerancePercent: 5 },
        { key: "cash", targetPercent: 50, tolerancePercent: 5 },
      ],
    });

    const result = evaluatePortfolioCompliance({
      rule,
      cashAmount: 200,
      positions: [{ ticker: "5803", market_value: 800, asset_type: "stock" }],
    });

    const stockDrift = result.violations.find(
      (v) => v.ruleKey === "target_allocation" && v.subject === "stock",
    );
    const cashDrift = result.violations.find(
      (v) => v.ruleKey === "target_allocation" && v.subject === "cash",
    );
    expect(stockDrift?.actualPercent).toBe(80);
    expect(cashDrift?.actualPercent).toBe(20);
  });

  it("stays quiet when allocations are within tolerance", () => {
    const rule = buildRule({
      targetAllocations: [
        { key: "stock", targetPercent: 80, tolerancePercent: 5 },
      ],
      minCashPercent: 10,
      maxPositionPercent: 90,
    });

    const result = evaluatePortfolioCompliance({
      rule,
      cashAmount: 200,
      positions: [{ ticker: "5803", market_value: 800, asset_type: "stock" }],
    });

    expect(result.violations).toEqual([]);
  });
});

describe("simulatePositionImpact", () => {
  it("reports new violations introduced by the candidate only", () => {
    const rule = buildRule({ maxThemePercent: 30 });

    const result = simulatePositionImpact({
      rule,
      cashAmount: 700,
      positions: [
        { ticker: "5803", market_value: 300, theme: "データセンター" },
      ],
      candidate: {
        ticker: "5801",
        marketValue: 200,
        theme: "データセンター",
        fundedFromCash: true,
      },
    });

    expect(result.before.violations).toEqual([]);
    expect(result.newViolations).toHaveLength(1);
    expect(result.newViolations[0]?.ruleKey).toBe("max_theme_percent");
    expect(result.themePercentAfter).toBe(50);
  });

  it("flags a candidate whose asset type is excluded", () => {
    const rule = buildRule({ excludedAssetTypes: ["暗号資産"] });

    const result = simulatePositionImpact({
      rule,
      cashAmount: 500,
      positions: [{ ticker: "5803", market_value: 500, asset_type: "stock" }],
      candidate: {
        ticker: "BTC",
        marketValue: 200,
        assetType: "暗号資産",
        fundedFromCash: true,
      },
    });

    expect(result.before.violations).toEqual([]);
    expect(result.newViolations).toHaveLength(1);
    expect(result.newViolations[0]?.ruleKey).toBe("excluded_asset_type");
  });

  it("keeps total value stable when funded from cash", () => {
    const result = simulatePositionImpact({
      rule: null,
      cashAmount: 500,
      positions: [{ ticker: "5803", market_value: 500 }],
      candidate: {
        ticker: "6758",
        marketValue: 200,
        fundedFromCash: true,
      },
    });

    expect(result.after.totalValue).toBe(1000);
    expect(result.tickerPercentAfter).toBe(20);
    expect(result.insufficientCash).toBe(false);
  });

  it("grows total value when funded with new money", () => {
    const result = simulatePositionImpact({
      rule: null,
      cashAmount: 500,
      positions: [{ ticker: "5803", market_value: 500 }],
      candidate: {
        ticker: "6758",
        marketValue: 200,
        fundedFromCash: false,
      },
    });

    expect(result.after.totalValue).toBe(1200);
  });

  it("flags insufficient cash", () => {
    const result = simulatePositionImpact({
      rule: null,
      cashAmount: 100,
      positions: [],
      candidate: {
        ticker: "6758",
        marketValue: 200,
        fundedFromCash: true,
      },
    });

    expect(result.insufficientCash).toBe(true);
    expect(result.after.totalValue).toBe(200);
  });

  it("merges the candidate with an existing position of the same ticker", () => {
    const rule = buildRule({ maxPositionPercent: 25 });

    const result = simulatePositionImpact({
      rule,
      cashAmount: 800,
      positions: [{ ticker: "5803", market_value: 200 }],
      candidate: {
        ticker: "5803",
        marketValue: 100,
        fundedFromCash: true,
      },
    });

    expect(result.tickerPercentAfter).toBe(30);
    expect(result.newViolations[0]?.subject).toBe("5803");
  });
});
