import { describe, expect, it } from "vitest";
import type { MarketQuote } from "@/features/market-data/provider";
import type { PortfolioHolding } from "@/features/portfolio/portfolio";
import {
  calculateValuation,
  summarizeValuation,
} from "@/features/portfolio/valuation";

function holding(overrides: Partial<PortfolioHolding> = {}): PortfolioHolding {
  return {
    stockId: "stock-1",
    stockName: "Example",
    ticker: "7203",
    marketCode: "JP",
    quantity: 2,
    averagePurchasePrice: 100,
    acquisitionAmount: 200,
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
  currency: "JPY" | "USD" = "JPY",
): MarketQuote {
  return {
    symbol,
    price,
    currency,
    priceAt: "2026-09-28T00:00:00.000Z",
    marketState: "regular",
    delayedByMinutes: 15,
    sourceName: "Yahoo Finance",
  };
}

describe("portfolio valuation", () => {
  it("calculates the requested JPY example and a negative profit", () => {
    const owned = holding({ quantity: 100, acquisitionAmount: 250000 });
    const gain = calculateValuation(
      [owned],
      new Map([["7203.T", quote("7203.T", 3000)]]),
    )[0];
    expect(gain).toMatchObject({
      marketValue: 300000,
      unrealizedProfitLoss: 50000,
      unrealizedProfitLossRate: 20,
    });

    const loss = calculateValuation(
      [owned],
      new Map([["7203.T", quote("7203.T", 2000)]]),
    )[0];
    expect(loss).toMatchObject({
      marketValue: 200000,
      unrealizedProfitLoss: -50000,
      unrealizedProfitLossRate: -20,
    });
  });

  it("maps Japanese tickers to market symbols and calculates full-precision values", () => {
    const result = calculateValuation(
      [holding({ quantity: 1.5, acquisitionAmount: 150 })],
      new Map([["7203.T", quote("7203.T", 120)]]),
    );

    expect(result[0]).toMatchObject({
      marketValue: 180,
      unrealizedProfitLoss: 30,
      unrealizedProfitLossRate: 20,
    });
  });

  it("keeps the quoted value in quote currency but suppresses profit on currency mismatch", () => {
    const result = calculateValuation(
      [holding()],
      new Map([["7203.T", quote("7203.T", 2, "USD")]]),
    );

    expect(result[0].quote?.price).toBe(2);
    expect(result[0].marketValue).toBe(4);
    expect(result[0].unrealizedProfitLoss).toBeNull();
    expect(result[0].quoteError).toContain("通貨が一致しない");
  });

  it("leaves unpriced and unmappable holdings unvalued", () => {
    const results = calculateValuation(
      [holding(), holding({ stockId: "no-ticker", ticker: null })],
      new Map(),
    );

    expect(results).toHaveLength(2);
    expect(results.every((item) => item.marketValue === null)).toBe(true);
    expect(results.every((item) => item.quote === null)).toBe(true);
    expect(results[0].quoteError).toContain("取得できません");
    expect(results[1].quoteError).toContain("銘柄コードがありません");
  });

  it("does not calculate profit when acquisition cost is unknown", () => {
    const result = calculateValuation(
      [holding({ acquisitionAmount: null, averagePurchasePrice: null })],
      new Map([["7203.T", quote("7203.T", 120)]]),
    );

    expect(result[0].marketValue).toBe(240);
    expect(result[0].unrealizedProfitLoss).toBeNull();
  });

  it("keeps JPY and USD summaries separate and suppresses incomplete totals", () => {
    const valued = calculateValuation(
      [
        holding(),
        holding({
          stockId: "unknown",
          ticker: "9984",
          acquisitionAmount: null,
        }),
        holding({
          stockId: "usd",
          ticker: "AAPL",
          marketCode: "US",
          currency: "USD",
          acquisitionAmount: 100,
          quantity: 1,
        }),
      ],
      new Map([
        ["7203.T", quote("7203.T", 120)],
        ["AAPL", quote("AAPL", 110, "USD")],
      ]),
    );
    const summaries = summarizeValuation(valued);

    expect(summaries.JPY).toMatchObject({
      marketValue: null,
      acquisitionAmount: null,
      unrealizedProfitLoss: null,
      composition: null,
      completeness: {
        marketValue: false,
        acquisitionAmount: false,
        profitLoss: false,
        allocation: false,
      },
    });
    expect(summaries.USD).toMatchObject({
      marketValue: 110,
      acquisitionAmount: 100,
      unrealizedProfitLoss: 10,
      composition: [
        {
          stockId: "usd",
          stockName: "Example",
          marketValue: 110,
          percent: 100,
        },
      ],
      completeness: {
        marketValue: true,
        acquisitionAmount: true,
        profitLoss: true,
        allocation: true,
      },
    });
  });

  it.each([
    ["JPY", "7203", "JP", "7203.T", 100],
    ["USD", "AAPL", "US", "AAPL", 10],
  ] as const)(
    "summarizes only %s holdings without currency conversion",
    (currency, ticker, marketCode, symbol, price) => {
      const valued = calculateValuation(
        [
          holding({
            ticker,
            marketCode,
            currency,
            quantity: 2,
            acquisitionAmount: price,
          }),
        ],
        new Map([[symbol, quote(symbol, price, currency)]]),
      );
      const summaries = summarizeValuation(valued);
      expect(summaries[currency].marketValue).toBe(price * 2);
      expect(summaries[currency].unrealizedProfitLoss).toBe(price);
      expect(summaries[currency].composition?.[0].percent).toBe(100);
      expect(
        summaries[currency === "JPY" ? "USD" : "JPY"].composition,
      ).toBeNull();
    },
  );

  it("marks an empty currency group as complete without inventing totals", () => {
    const summary = summarizeValuation([]);

    expect(summary.JPY.marketValue).toBe(0);
    expect(summary.JPY.composition).toBeNull();
    expect(summary.JPY.completeness.allocation).toBe(false);
    expect(summary.USD.marketValue).toBe(0);
  });

  it("builds separate currency compositions from positive-quantity holdings", () => {
    const valued = calculateValuation(
      [
        holding({ stockId: "first", quantity: 1 }),
        holding({ stockId: "second", ticker: "6758", quantity: 3 }),
        holding({ stockId: "closed", quantity: 0 }),
        holding({
          stockId: "usd",
          ticker: "AAPL",
          marketCode: "US",
          currency: "USD",
        }),
      ],
      new Map([
        ["7203.T", quote("7203.T", 100)],
        ["6758.T", quote("6758.T", 100)],
        ["AAPL", quote("AAPL", 10, "USD")],
      ]),
    );
    const summaries = summarizeValuation(valued);

    expect(summaries.JPY.composition).toEqual([
      { stockId: "first", stockName: "Example", marketValue: 100, percent: 25 },
      {
        stockId: "second",
        stockName: "Example",
        marketValue: 300,
        percent: 75,
      },
    ]);
    expect(summaries.USD.composition).toEqual([
      { stockId: "usd", stockName: "Example", marketValue: 20, percent: 100 },
    ]);
  });
});
