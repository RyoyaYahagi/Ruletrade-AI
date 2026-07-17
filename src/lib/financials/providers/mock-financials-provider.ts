import "server-only";

import type { FinancialsProvider, FinancialStatement } from "@/lib/financials/financials-provider";

export class MockFinancialsProvider implements FinancialsProvider {
  readonly name = "mock" as const;

  async fetchNewStatements(params: {
    tickers: string[];
    sinceDate: string;
  }): Promise<FinancialStatement[]> {
    const fiscalPeriod = `FY${new Date().getUTCFullYear()}`;
    return params.tickers.map((ticker) => ({
      ticker,
      market: "JP",
      fiscalPeriod,
      revenue: deterministicNumber(`${ticker}:revenue`, 1_000_000, 9_000_000),
      // Missing provider fields stay null. Zero would incorrectly mean a reported zero.
      operatingIncome: null,
      netIncome: deterministicNumber(`${ticker}:net-income`, 100_000, 900_000),
      eps: deterministicNumber(`${ticker}:eps`, 10, 500) / 10,
      dividendPerShare: deterministicNumber(`${ticker}:dividend`, 0, 300) / 10,
      equityRatio: null,
      currency: "JPY",
      filedAt: params.sinceDate,
    }));
  }
}

function deterministicNumber(seed: string, min: number, max: number) {
  let hash = 0;
  for (const character of seed) {
    hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  }
  return min + (hash % (max - min + 1));
}
