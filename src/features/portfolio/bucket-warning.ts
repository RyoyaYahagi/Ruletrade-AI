import type { ExchangeRate } from "@/features/market-data/exchange-rate";
import type { BucketSummary } from "@/features/portfolio/bucket-summary";

export type BucketWarning = {
  warnPct: number;
  marketValuePct: number;
  marketValueJpy: number | null;
  exchangeRate: ExchangeRate | null;
  message: string;
};

export function evaluateBucketWarning(
  summary: BucketSummary,
  warnPct: number | null,
): BucketWarning | null {
  if (warnPct === null) return null;
  const marketValuePct = summary.satelliteMarketValuePct;
  if (marketValuePct === null || marketValuePct <= warnPct) return null;
  return {
    warnPct,
    marketValuePct,
    marketValueJpy: summary.satelliteMarketValueJpy,
    exchangeRate: summary.exchangeRate,
    message: "時価ベースのサテライト割合が警告線を超えています。",
  };
}
