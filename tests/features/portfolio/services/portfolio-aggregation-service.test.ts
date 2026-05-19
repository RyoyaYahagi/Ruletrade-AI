import { describe, expect, it } from "vitest";
import {
  calculatePortfolioSummary,
  calculatePortfolioAllocationSummary,
} from "@/features/portfolio/services/portfolio-aggregation-service";

describe("calculatePortfolioSummary", () => {
  it("calculates totalValue from positions and cash", () => {
    const result = calculatePortfolioSummary({
      cashAmount: 100000,
      positions: [
        { ticker: "7203.T", market_value: 50000 },
        { ticker: "9984.T", market_value: 30000 },
      ],
    });

    expect(result.totalValue).toBe(180000);
    expect(result.totalPositionValue).toBe(80000);
    expect(result.cashAmount).toBe(100000);
    expect(result.positionCount).toBe(2);
  });

  it("calculates cashWeightPercent correctly", () => {
    const result = calculatePortfolioSummary({
      cashAmount: 100000,
      positions: [
        { ticker: "7203.T", market_value: 100000 },
        { ticker: "9984.T", market_value: 100000 },
      ],
    });

    // cash = 100000, total = 300000, cash% = 33.33
    expect(result.cashWeightPercent).toBe(33.33);
  });

  it("returns 0 for cashWeightPercent when totalValue is 0", () => {
    const result = calculatePortfolioSummary({
      cashAmount: 0,
      positions: [],
    });

    expect(result.totalValue).toBe(0);
    expect(result.cashWeightPercent).toBe(0);
  });

  it("calculates weightPercent for each position", () => {
    const result = calculatePortfolioSummary({
      cashAmount: 0,
      positions: [
        { ticker: "7203.T", market_value: 75000 },
        { ticker: "9984.T", market_value: 25000 },
      ],
    });

    expect(result.positionsWithWeight).toHaveLength(2);
    expect(result.positionsWithWeight[0].weightPercent).toBe(75);
    expect(result.positionsWithWeight[1].weightPercent).toBe(25);
  });

  it("calculates sectorWeights correctly", () => {
    const result = calculatePortfolioSummary({
      cashAmount: 0,
      positions: [
        { ticker: "7203.T", market_value: 60000, sector: "Automotive" },
        { ticker: "9984.T", market_value: 40000, sector: "Technology" },
      ],
    });

    expect(result.sectorWeights).toHaveLength(2);
    const autoSector = result.sectorWeights.find(
      (s) => s.sector === "Automotive",
    );
    const techSector = result.sectorWeights.find(
      (s) => s.sector === "Technology",
    );
    expect(autoSector?.weightPercent).toBe(60);
    expect(techSector?.weightPercent).toBe(40);
  });

  it("groups same sector positions together", () => {
    const result = calculatePortfolioSummary({
      cashAmount: 0,
      positions: [
        { ticker: "7203.T", market_value: 30000, sector: "Automotive" },
        { ticker: "7267.T", market_value: 30000, sector: "Automotive" },
        { ticker: "9984.T", market_value: 40000, sector: "Technology" },
      ],
    });

    expect(result.sectorWeights).toHaveLength(2);
    const autoSector = result.sectorWeights.find(
      (s) => s.sector === "Automotive",
    );
    expect(autoSector?.weightPercent).toBe(60);
  });

  it("classifies positions without sector as 未分類", () => {
    const result = calculatePortfolioSummary({
      cashAmount: 0,
      positions: [
        { ticker: "7203.T", market_value: 50000 },
        { ticker: "9984.T", market_value: 50000, sector: "Technology" },
      ],
    });

    const unclassified = result.sectorWeights.find(
      (s) => s.sector === "未分類",
    );
    expect(unclassified).toBeDefined();
    expect(unclassified?.weightPercent).toBe(50);
  });

  it("counts positions without rule_session_id", () => {
    const result = calculatePortfolioSummary({
      cashAmount: 0,
      positions: [
        { ticker: "7203.T", market_value: 50000, rule_session_id: "rule-1" },
        { ticker: "9984.T", market_value: 50000 },
        { ticker: "6758.T", market_value: 50000 },
      ],
    });

    expect(result.positionsWithoutRuleCount).toBe(2);
  });

  it("handles empty positions array", () => {
    const result = calculatePortfolioSummary({
      cashAmount: 0,
      positions: [],
    });

    expect(result.totalValue).toBe(0);
    expect(result.totalPositionValue).toBe(0);
    expect(result.positionCount).toBe(0);
    expect(result.sectorWeights).toEqual([]);
    expect(result.positionsWithWeight).toEqual([]);
    expect(result.positionsWithoutRuleCount).toBe(0);
  });
});

describe("calculatePortfolioAllocationSummary", () => {
  it("calculates market allocation correctly", () => {
    const result = calculatePortfolioAllocationSummary({
      cashAmount: 0,
      positions: [
        { market_value: 60000, market: "JP" },
        { market_value: 40000, market: "US" },
      ],
    });

    expect(result.totalValue).toBe(100000);
    expect(result.marketAllocation).toHaveLength(2);
    const jpAlloc = result.marketAllocation.find((a) => a.key === "JP");
    const usAlloc = result.marketAllocation.find((a) => a.key === "US");
    expect(jpAlloc?.value).toBe(60000);
    expect(jpAlloc?.percent).toBe(60);
    expect(usAlloc?.value).toBe(40000);
    expect(usAlloc?.percent).toBe(40);
  });

  it("calculates sector allocation across all positions", () => {
    const result = calculatePortfolioAllocationSummary({
      cashAmount: 0,
      positions: [
        { market_value: 50000, sector: "Automotive" },
        { market_value: 30000, sector: "Technology" },
        { market_value: 20000, sector: "Automotive" },
      ],
    });

    expect(result.sectorAllocation).toHaveLength(2);
    const autoAlloc = result.sectorAllocation.find(
      (a) => a.key === "Automotive",
    );
    expect(autoAlloc?.value).toBe(70000);
  });

  it("calculates theme allocation across all positions", () => {
    const result = calculatePortfolioAllocationSummary({
      cashAmount: 0,
      positions: [
        { market_value: 50000, theme: "AI" },
        { market_value: 50000, theme: "Green Energy" },
      ],
    });

    expect(result.themeAllocation).toHaveLength(2);
    const aiAlloc = result.themeAllocation.find((a) => a.key === "AI");
    expect(aiAlloc?.percent).toBe(50);
  });

  it("calculates JP-specific sector allocation", () => {
    const result = calculatePortfolioAllocationSummary({
      cashAmount: 0,
      positions: [
        { market_value: 30000, market: "JP", sector: "Automotive" },
        { market_value: 20000, market: "JP", sector: "Technology" },
        { market_value: 50000, market: "US", sector: "Technology" },
      ],
    });

    expect(result.jpSectorAllocation).toHaveLength(2);
    expect(result.usSectorAllocation).toHaveLength(1);
  });

  it("calculates US-specific theme allocation", () => {
    const result = calculatePortfolioAllocationSummary({
      cashAmount: 0,
      positions: [
        { market_value: 40000, market: "US", theme: "AI" },
        { market_value: 10000, market: "US", theme: "Cloud" },
        { market_value: 50000, market: "JP", theme: "AI" },
      ],
    });

    expect(result.usThemeAllocation).toHaveLength(2);
    expect(result.jpThemeAllocation).toHaveLength(1);
  });

  it("classifies unset market/sector/theme as 未分類", () => {
    const result = calculatePortfolioAllocationSummary({
      cashAmount: 0,
      positions: [
        { market_value: 100000 },
        {
          market_value: 50000,
          market: "JP",
          sector: "Technology",
          theme: "AI",
        },
      ],
    });

    const unclassifiedMarket = result.marketAllocation.find(
      (a) => a.key === "未分類",
    );
    expect(unclassifiedMarket).toBeDefined();
    expect(unclassifiedMarket?.value).toBe(100000);

    const unclassifiedSector = result.sectorAllocation.find(
      (a) => a.key === "未分類",
    );
    expect(unclassifiedSector).toBeDefined();
    expect(unclassifiedSector?.value).toBe(100000);

    const unclassifiedTheme = result.themeAllocation.find(
      (a) => a.key === "未分類",
    );
    expect(unclassifiedTheme).toBeDefined();
    expect(unclassifiedTheme?.value).toBe(100000);
  });

  it("skips positions with zero or negative market_value", () => {
    const result = calculatePortfolioAllocationSummary({
      cashAmount: 0,
      positions: [
        { market_value: 50000, market: "JP" },
        { market_value: 0, market: "US" },
        { market_value: -100, market: "US" },
      ],
    });

    expect(result.marketAllocation).toHaveLength(1);
    const jpAlloc = result.marketAllocation.find((a) => a.key === "JP");
    expect(jpAlloc?.value).toBe(50000);
  });

  it("includes cash in totalValue", () => {
    const result = calculatePortfolioAllocationSummary({
      cashAmount: 200000,
      positions: [{ market_value: 80000, market: "JP" }],
    });

    expect(result.totalValue).toBe(280000);
    expect(result.cashValue).toBe(200000);
  });

  it("handles empty positions", () => {
    const result = calculatePortfolioAllocationSummary({
      cashAmount: 0,
      positions: [],
    });

    expect(result.totalValue).toBe(0);
    expect(result.marketAllocation).toEqual([]);
    expect(result.sectorAllocation).toEqual([]);
    expect(result.themeAllocation).toEqual([]);
    expect(result.jpSectorAllocation).toEqual([]);
    expect(result.usThemeAllocation).toEqual([]);
  });

  it("returns allocation slices sorted by value descending", () => {
    const result = calculatePortfolioAllocationSummary({
      cashAmount: 0,
      positions: [
        { market_value: 10000, market: "US" },
        { market_value: 30000, market: "JP" },
        { market_value: 20000, market: "EU" },
      ],
    });

    const values = result.marketAllocation.map((a) => a.value);
    expect(values).toEqual([30000, 20000, 10000]);
  });
});
