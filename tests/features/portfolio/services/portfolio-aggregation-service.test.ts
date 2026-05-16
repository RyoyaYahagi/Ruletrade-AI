import { describe, it, expect } from "vitest";

import {
  calculatePortfolioSummary,
  calculatePortfolioAllocationSummary,
} from "@/features/portfolio/services/portfolio-aggregation-service";

describe("calculatePortfolioSummary", () => {
  it("returns zero when no positions", () => {
    const result = calculatePortfolioSummary({
      cashAmount: 0,
      positions: [],
    });

    expect(result.totalValue).toBe(0);
    expect(result.cashWeightPercent).toBe(0);
    expect(result.positionCount).toBe(0);
    expect(result.positionsWithWeight).toEqual([]);
    expect(result.positionsWithoutRuleCount).toBe(0);
  });

  it("calculates total value and weights correctly", () => {
    const result = calculatePortfolioSummary({
      cashAmount: 300_000,
      positions: [
        { ticker: "AAPL", market_value: 500_000, company_name: "Apple" },
        { ticker: "MSFT", market_value: 200_000, company_name: "Microsoft" },
      ],
    });

    expect(result.totalValue).toBe(1_000_000);
    expect(result.totalPositionValue).toBe(700_000);
    expect(result.cashAmount).toBe(300_000);
    expect(result.cashWeightPercent).toBe(30);
    expect(result.positionCount).toBe(2);
  });

  it("calculates position weights as percentages of total", () => {
    const result = calculatePortfolioSummary({
      cashAmount: 0,
      positions: [
        { ticker: "A", market_value: 600 },
        { ticker: "B", market_value: 400 },
      ],
    });

    expect(result.positionsWithWeight[0].weightPercent).toBe(60);
    expect(result.positionsWithWeight[1].weightPercent).toBe(40);
  });

  it("groups sectors and calculates sector weights", () => {
    const result = calculatePortfolioSummary({
      cashAmount: 0,
      positions: [
        { ticker: "A", market_value: 300, sector: "Tech" },
        { ticker: "B", market_value: 200, sector: "Tech" },
        { ticker: "C", market_value: 500, sector: "Finance" },
      ],
    });

    expect(result.sectorWeights).toEqual([
      { sector: "Tech", weightPercent: 50 },
      { sector: "Finance", weightPercent: 50 },
    ]);
  });

  it("uses '未分類' for missing sectors", () => {
    const result = calculatePortfolioSummary({
      cashAmount: 0,
      positions: [
        { ticker: "A", market_value: 100 },
        { ticker: "B", market_value: 200, sector: "Tech" },
      ],
    });

    expect(result.sectorWeights).toEqual(
      expect.arrayContaining([
        { sector: "未分類", weightPercent: 33.33 },
        { sector: "Tech", weightPercent: 66.67 },
      ]),
    );
  });

  it("counts positions without rule_session_id", () => {
    const result = calculatePortfolioSummary({
      cashAmount: 0,
      positions: [
        { ticker: "A", market_value: 100, rule_session_id: "session-1" },
        { ticker: "B", market_value: 200 },
        { ticker: "C", market_value: 300, rule_session_id: "session-2" },
      ],
    });

    expect(result.positionsWithoutRuleCount).toBe(1);
  });

  it("handles all positions having rule_session_id", () => {
    const result = calculatePortfolioSummary({
      cashAmount: 0,
      positions: [
        { ticker: "A", market_value: 100, rule_session_id: "session-1" },
      ],
    });

    expect(result.positionsWithoutRuleCount).toBe(0);
  });

  it("handles zero total value gracefully", () => {
    const result = calculatePortfolioSummary({
      cashAmount: 0,
      positions: [{ ticker: "A", market_value: 0 }],
    });

    expect(result.totalValue).toBe(0);
    expect(result.positionsWithWeight[0].weightPercent).toBe(0);
    expect(result.cashWeightPercent).toBe(0);
  });

  it("handles positions with null market_value", () => {
    const result = calculatePortfolioSummary({
      cashAmount: 100,
      positions: [
        { ticker: "A", market_value: null as unknown as number },
        { ticker: "B", market_value: 200 },
      ],
    });

    expect(result.totalValue).toBe(300);
    expect(result.totalPositionValue).toBe(200);
  });
});

describe("calculatePortfolioAllocationSummary", () => {
  it("returns zero allocations for empty positions", () => {
    const result = calculatePortfolioAllocationSummary({
      cashAmount: 0,
      positions: [],
    });

    expect(result.totalValue).toBe(0);
    expect(result.marketAllocation).toEqual([]);
    expect(result.assetTypeAllocation).toEqual([]);
    expect(result.sectorAllocation).toEqual([]);
  });

  it("allocates by market", () => {
    const result = calculatePortfolioAllocationSummary({
      cashAmount: 0,
      positions: [
        { market_value: 300, market: "JP" },
        { market_value: 200, market: "JP" },
        { market_value: 500, market: "US" },
      ],
    });

    expect(result.marketAllocation).toEqual([
      { key: "JP", label: "JP", value: 500, percent: 50 },
      { key: "US", label: "US", value: 500, percent: 50 },
    ]);
  });

  it("allocates by asset type", () => {
    const result = calculatePortfolioAllocationSummary({
      cashAmount: 0,
      positions: [
        { market_value: 400, asset_type: "stock" },
        { market_value: 200, asset_type: "stock" },
        { market_value: 400, asset_type: "etf" },
      ],
    });

    expect(result.assetTypeAllocation).toEqual([
      { key: "stock", label: "stock", value: 600, percent: 60 },
      { key: "etf", label: "etf", value: 400, percent: 40 },
    ]);
  });

  it("allocates by sector", () => {
    const result = calculatePortfolioAllocationSummary({
      cashAmount: 0,
      positions: [
        { market_value: 300, sector: "Tech" },
        { market_value: 200, sector: "Tech" },
        { market_value: 500, sector: "Finance" },
      ],
    });

    expect(result.sectorAllocation).toEqual([
      { key: "Tech", label: "Tech", value: 500, percent: 50 },
      { key: "Finance", label: "Finance", value: 500, percent: 50 },
    ]);
  });

  it("allocates by theme", () => {
    const result = calculatePortfolioAllocationSummary({
      cashAmount: 0,
      positions: [
        { market_value: 300, theme: "Growth" },
        { market_value: 700, theme: "Value" },
      ],
    });

    expect(result.themeAllocation).toEqual([
      { key: "Value", label: "Value", value: 700, percent: 70 },
      { key: "Growth", label: "Growth", value: 300, percent: 30 },
    ]);
  });

  it("allocates JP sectors separately", () => {
    const result = calculatePortfolioAllocationSummary({
      cashAmount: 0,
      positions: [
        { market_value: 300, market: "JP", sector: "Tech" },
        { market_value: 200, market: "JP", sector: "Finance" },
        { market_value: 500, market: "US", sector: "Tech" },
      ],
    });

    expect(result.jpSectorAllocation).toEqual([
      { key: "Tech", label: "Tech", value: 300, percent: 30 },
      { key: "Finance", label: "Finance", value: 200, percent: 20 },
    ]);
  });

  it("allocates US sectors separately", () => {
    const result = calculatePortfolioAllocationSummary({
      cashAmount: 0,
      positions: [
        { market_value: 400, market: "US", sector: "Tech" },
        { market_value: 100, market: "US", sector: "Health" },
      ],
    });

    expect(result.usSectorAllocation).toEqual([
      { key: "Tech", label: "Tech", value: 400, percent: 80 },
      { key: "Health", label: "Health", value: 100, percent: 20 },
    ]);
  });

  it("includes cash in total value", () => {
    const result = calculatePortfolioAllocationSummary({
      cashAmount: 100,
      positions: [
        { market_value: 300, market: "JP" },
      ],
    });

    expect(result.totalValue).toBe(400);
    expect(result.cashValue).toBe(100);
  });

  it("ignores positions with zero or negative market_value", () => {
    const result = calculatePortfolioAllocationSummary({
      cashAmount: 0,
      positions: [
        { market_value: 300, sector: "Tech" },
        { market_value: 0, sector: "Finance" },
        { market_value: -100, sector: "Health" },
      ],
    });

    expect(result.sectorAllocation.length).toBe(1);
    expect(result.sectorAllocation[0].key).toBe("Tech");
  });

  it("uses '未分類' for missing attributes", () => {
    const result = calculatePortfolioAllocationSummary({
      cashAmount: 0,
      positions: [
        { market_value: 100 },
      ],
    });

    expect(result.marketAllocation[0].key).toBe("未分類");
    expect(result.assetTypeAllocation[0].key).toBe("未分類");
    expect(result.sectorAllocation[0].key).toBe("未分類");
    expect(result.themeAllocation[0].key).toBe("未分類");
  });

  it("sorts allocations by value descending", () => {
    const result = calculatePortfolioAllocationSummary({
      cashAmount: 0,
      positions: [
        { market_value: 100, sector: "C" },
        { market_value: 300, sector: "A" },
        { market_value: 200, sector: "B" },
      ],
    });

    expect(result.sectorAllocation.map((s) => s.key)).toEqual([
      "A",
      "B",
      "C",
    ]);
  });
});
