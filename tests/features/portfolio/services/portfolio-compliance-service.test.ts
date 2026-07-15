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
