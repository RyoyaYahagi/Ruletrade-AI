import { describe, expect, it } from "vitest";

import type { ExchangeRate } from "@/features/market-data/exchange-rate";
import type { MarketQuote } from "@/features/market-data/provider";
import {
  buildBucketSummary,
  calculateInvestedTotals,
} from "@/features/portfolio/bucket-summary";
import {
  calculateValuation,
  summarizeValuation,
} from "@/features/portfolio/valuation";
import {
  calculatePortfolio,
  type PortfolioHolding,
} from "@/features/portfolio/portfolio";
import type { Bucket } from "@/schemas/stock";
import type { Transaction } from "@/schemas/transaction";

const RATE: ExchangeRate = {
  rate: 150,
  priceAt: "2026-11-07T05:21:16.000Z",
  sourceName: "Delayed Quote",
};

function tx(
  id: string,
  stockId: string,
  side: "buy" | "sell",
  quantity: number,
  price: number | null,
  currency: "JPY" | "USD" | null = "JPY",
): Transaction {
  return {
    id,
    stockId,
    side,
    quantity,
    price,
    fee: null,
    executedAt: "2026-01-01T00:00:00.000Z",
    decisionId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    priceCurrency: currency,
  };
}

function holding(
  stockId: string,
  stockName: string,
  bucket: Bucket,
  overrides: Partial<PortfolioHolding> = {},
): PortfolioHolding {
  return {
    stockId,
    stockName,
    ticker: null,
    marketCode: null,
    bucket,
    quantity: 1,
    averagePurchasePrice: 1000,
    acquisitionAmount: 1000,
    currency: "JPY",
    hasWarning: false,
    warningReason: null,
    adjustments: [],
    ...overrides,
  };
}

function quote(
  symbol: string,
  price: number,
  currency: "JPY" | "USD",
): MarketQuote {
  return {
    symbol,
    price,
    currency,
    priceAt: "2026-11-07T05:21:16.000Z",
    marketState: "CLOSED",
    delayedByMinutes: 15,
    sourceName: "Delayed Quote",
  };
}

describe("calculateInvestedTotals", () => {
  it("keeps gross buy amounts after a full sale (D1)", () => {
    const stocks = [
      { id: "sat", name: "サテライト社", bucket: "satellite" as const },
      { id: "core", name: "コア社", bucket: "core" as const },
    ];
    const result = calculateInvestedTotals(stocks, [
      tx("buy-sat", "sat", "buy", 10, 1000),
      tx("sell-sat", "sat", "sell", 10, 1500),
      tx("buy-core", "core", "buy", 5, 2000),
    ]);

    expect(result.complete).toBe(true);
    expect(result.byBucket).toEqual({
      core: { JPY: 10000, USD: 0 },
      satellite: { JPY: 10000, USD: 0 },
      unclassified: { JPY: 0, USD: 0 },
    });
  });

  it("marks the invested total incomplete when a buy has no price or currency", () => {
    const result = calculateInvestedTotals(
      [{ id: "sat", name: "サテライト社", bucket: "satellite" as const }],
      [
        tx("buy-known", "sat", "buy", 1, 1000),
        tx("buy-no-price", "sat", "buy", 1, null),
        tx("buy-no-currency", "sat", "buy", 1, 1000, null),
      ],
    );

    expect(result.complete).toBe(false);
    expect(result.byBucket.satellite).toEqual({ JPY: 1000, USD: 0 });
  });
});

describe("buildBucketSummary", () => {
  it("separates core, satellite and unclassified and folds unclassified into satellite", () => {
    const summary = buildBucketSummary({
      stocks: [
        { id: "core", name: "コア社", bucket: "core" },
        { id: "sat", name: "サテライト社", bucket: "satellite" },
        { id: "unknown", name: "未分類社", bucket: "unclassified" },
      ],
      holdings: [
        holding("core", "コア社", "core", { acquisitionAmount: 15000 }),
        holding("sat", "サテライト社", "satellite", {
          acquisitionAmount: 10000,
        }),
        holding("unknown", "未分類社", "unclassified", {
          acquisitionAmount: 5000,
        }),
      ],
      transactions: [
        tx("core-buy", "core", "buy", 15, 1000),
        tx("sat-buy", "sat", "buy", 10, 1000),
        tx("unknown-buy", "unknown", "buy", 5, 1000),
      ],
      quotes: new Map(),
      exchangeRate: null,
    });

    expect(summary.buckets.core.investedJpy).toBe(15000);
    expect(summary.satelliteInvestedJpy).toBe(15000);
    expect(summary.satelliteInvestedPct).toBe(50);
    expect(summary.includesUnclassified).toBe(true);
    expect(summary.coreRegistered).toBe(true);
    expect(summary.rateRequired).toBe(false);
    expect(summary.rateUnavailable).toBe(false);
  });

  it("converts mixed currencies with one current rate and keeps the rate metadata", () => {
    const summary = buildBucketSummary({
      stocks: [
        { id: "core", name: "コア社", bucket: "core" },
        { id: "sat", name: "サテライト社", bucket: "satellite" },
      ],
      holdings: [
        holding("core", "コア社", "core", {
          ticker: "7203",
          marketCode: "JP",
          quantity: 100,
          currency: "JPY",
          acquisitionAmount: 100000,
        }),
        holding("sat", "サテライト社", "satellite", {
          ticker: "AAPL",
          marketCode: "US",
          quantity: 10,
          currency: "USD",
          acquisitionAmount: 1000,
        }),
      ],
      transactions: [
        tx("core-buy", "core", "buy", 100, 1000, "JPY"),
        tx("sat-buy", "sat", "buy", 10, 100, "USD"),
      ],
      quotes: new Map([
        ["7203.T", quote("7203.T", 1200, "JPY")],
        ["AAPL", quote("AAPL", 120, "USD")],
      ]),
      exchangeRate: RATE,
    });

    expect(summary.buckets.core.investedJpy).toBe(100000);
    expect(summary.buckets.satellite.investedJpy).toBe(150000);
    expect(summary.totalInvestedJpy).toBe(250000);
    expect(summary.satelliteInvestedPct).toBe(60);
    expect(summary.buckets.core.marketValueJpy).toBe(120000);
    expect(summary.buckets.satellite.marketValueJpy).toBe(180000);
    expect(summary.totalMarketValueJpy).toBe(300000);
    expect(summary.satelliteMarketValuePct).toBe(60);
    expect(summary.exchangeRate).toEqual(RATE);
    expect(summary.rateRequired).toBe(true);
    expect(summary.substitutedStockIds).toEqual([]);
  });

  it("uses the acquisition amount when a quote is missing and records the substitution", () => {
    const summary = buildBucketSummary({
      stocks: [{ id: "sat", name: "投信", bucket: "satellite" }],
      holdings: [
        holding("sat", "投信", "satellite", {
          ticker: null,
          marketCode: null,
          quantity: 10,
          currency: "JPY",
          acquisitionAmount: 12345,
        }),
      ],
      transactions: [tx("buy", "sat", "buy", 10, 1234.5)],
      quotes: new Map(),
      exchangeRate: RATE,
    });

    expect(summary.buckets.satellite.marketValueJpy).toBe(12345);
    expect(summary.substitutedStockIds).toEqual(["sat"]);
    expect(summary.substitutedStockNames).toEqual(["投信"]);
    expect(summary.marketValueComplete).toBe(true);
  });

  it("does not produce ratios when a USD amount needs a missing rate", () => {
    const summary = buildBucketSummary({
      stocks: [
        { id: "core", name: "コア社", bucket: "core" },
        { id: "sat", name: "サテライト社", bucket: "satellite" },
      ],
      holdings: [
        holding("core", "コア社", "core", { acquisitionAmount: 100000 }),
        holding("sat", "サテライト社", "satellite", {
          quantity: 10,
          currency: "USD",
          acquisitionAmount: 1000,
        }),
      ],
      transactions: [
        tx("core-buy", "core", "buy", 100, 1000, "JPY"),
        tx("sat-buy", "sat", "buy", 10, 100, "USD"),
      ],
      quotes: new Map(),
      exchangeRate: null,
    });

    expect(summary.rateRequired).toBe(true);
    expect(summary.rateUnavailable).toBe(true);
    expect(summary.buckets.satellite.investedJpy).toBeNull();
    expect(summary.totalInvestedJpy).toBeNull();
    expect(summary.satelliteInvestedPct).toBeNull();
    expect(summary.satelliteMarketValuePct).toBeNull();
  });

  it("matches the existing valuation for currently held stocks in each currency", () => {
    const stocks = [
      {
        id: "jp",
        name: "日本株",
        ticker: "7203",
        marketCode: "JP",
        market: "JP",
        bucket: "core" as const,
      },
      {
        id: "us",
        name: "米国株",
        ticker: "AAPL",
        marketCode: "US",
        market: "US",
        bucket: "satellite" as const,
      },
    ];
    const transactions = [
      tx("jp-buy", "jp", "buy", 100, 1000, "JPY"),
      tx("us-buy", "us", "buy", 10, 100, "USD"),
    ];
    const holdings = calculatePortfolio(transactions, stocks);
    const quotes = new Map([
      ["7203.T", quote("7203.T", 1200, "JPY")],
      ["AAPL", quote("AAPL", 120, "USD")],
    ]);
    const valuation = summarizeValuation(calculateValuation(holdings, quotes));
    const summary = buildBucketSummary({
      stocks,
      holdings,
      transactions,
      quotes,
      exchangeRate: RATE,
    });

    expect(summary.totalMarketValueJpy).toBe(
      valuation.JPY.marketValue! + valuation.USD.marketValue! * RATE.rate,
    );
    expect(summary.totalInvestedJpy).toBe(
      valuation.JPY.acquisitionAmount! +
        valuation.USD.acquisitionAmount! * RATE.rate,
    );
  });
});
