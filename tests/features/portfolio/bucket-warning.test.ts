import { describe, expect, it } from "vitest";

import type { BucketSummary } from "@/features/portfolio/bucket-summary";
import { evaluateBucketWarning } from "@/features/portfolio/bucket-warning";

function summary(marketValuePct: number | null): BucketSummary {
  return {
    buckets: {
      core: {
        bucket: "core",
        stockCount: 0,
        heldStockCount: 0,
        investedByCurrency: { JPY: 0, USD: 0 },
        investedJpy: 0,
        marketValueByCurrency: { JPY: 0, USD: 0 },
        marketValueJpy: 0,
        investedComplete: true,
        marketValueComplete: true,
      },
      satellite: {
        bucket: "satellite",
        stockCount: 1,
        heldStockCount: 1,
        investedByCurrency: { JPY: 10000, USD: 0 },
        investedJpy: 10000,
        marketValueByCurrency: { JPY: 10000, USD: 0 },
        marketValueJpy: 10000,
        investedComplete: true,
        marketValueComplete: true,
      },
      unclassified: {
        bucket: "unclassified",
        stockCount: 0,
        heldStockCount: 0,
        investedByCurrency: { JPY: 0, USD: 0 },
        investedJpy: 0,
        marketValueByCurrency: { JPY: 0, USD: 0 },
        marketValueJpy: 0,
        investedComplete: true,
        marketValueComplete: true,
      },
    },
    totalInvestedJpy: 10000,
    totalMarketValueJpy: 10000,
    satelliteInvestedJpy: 10000,
    satelliteInvestedPct: 100,
    satelliteMarketValueJpy: 10000,
    satelliteMarketValuePct: marketValuePct,
    exchangeRate: null,
    rateRequired: false,
    rateUnavailable: false,
    includesUnclassified: false,
    coreRegistered: false,
    substitutedStockIds: [],
    substitutedStockNames: [],
    investedComplete: true,
    marketValueComplete: true,
  };
}

describe("evaluateBucketWarning", () => {
  it("does not warn below the line", () => {
    expect(evaluateBucketWarning(summary(39.9), 40)).toBeNull();
  });

  it("does not warn exactly on the line", () => {
    expect(evaluateBucketWarning(summary(40), 40)).toBeNull();
  });

  it("warns strictly above the line", () => {
    expect(evaluateBucketWarning(summary(40.1), 40)).toMatchObject({
      warnPct: 40,
      marketValuePct: 40.1,
      marketValueJpy: 10000,
      message: "時価ベースのサテライト割合が警告線を超えています。",
    });
  });

  it("does not warn when the line or the market ratio is unavailable", () => {
    expect(evaluateBucketWarning(summary(50), null)).toBeNull();
    expect(evaluateBucketWarning(summary(null), 40)).toBeNull();
  });
});
