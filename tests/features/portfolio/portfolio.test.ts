import { describe, expect, it } from "vitest";
import type { Transaction } from "@/schemas/transaction";
import {
  calculatePortfolio,
  type PortfolioStock,
} from "@/features/portfolio/portfolio";
import { SONY_FINANCIAL_STOCK } from "@/features/portfolio/corporate-actions";
import { calculateValuation } from "@/features/portfolio/valuation";
import type { MarketQuote } from "@/features/market-data/provider";

const stock: PortfolioStock = {
  id: "stock-1",
  name: "Example Corp",
  ticker: "EX",
  marketCode: "TSE",
};

function trade(
  id: string,
  side: "buy" | "sell",
  quantity: number,
  price: number | null,
  day: number,
  options: Partial<Transaction> = {},
): Transaction {
  const timestamp = `2026-01-${String(day).padStart(2, "0")}T00:00:00.000Z`;
  return {
    id,
    stockId: stock.id,
    side,
    quantity,
    price,
    fee: null,
    executedAt: timestamp,
    decisionId: null,
    createdAt: timestamp,
    priceCurrency: "JPY",
    ...options,
  };
}

function holding(transactions: readonly Transaction[]) {
  return calculatePortfolio(transactions, [stock])[0];
}

describe("calculatePortfolio", () => {
  it("returns holdings for purchases and computes weighted average cost", () => {
    expect(holding([trade("b1", "buy", 100, 1000, 1)])).toMatchObject({
      quantity: 100,
      averagePurchasePrice: 1000,
      acquisitionAmount: 100000,
    });
    expect(
      holding([
        trade("b1", "buy", 100, 1000, 1),
        trade("b2", "buy", 100, 2000, 2),
      ]),
    ).toMatchObject({
      quantity: 200,
      averagePurchasePrice: 1500,
      acquisitionAmount: 300000,
    });
  });

  it("keeps average cost after a partial sale and hides a fully sold position", () => {
    expect(
      holding([
        trade("b1", "buy", 100, 1000, 1),
        trade("b2", "buy", 100, 2000, 2),
        trade("s1", "sell", 100, 2500, 3),
      ]),
    ).toMatchObject({ quantity: 100, averagePurchasePrice: 1500 });
    expect(
      calculatePortfolio(
        [trade("b1", "buy", 100, 1000, 1), trade("s1", "sell", 100, 1000, 2)],
        [stock],
      ),
    ).toEqual([]);
  });

  it("resets cost after full sale and supports fractional quantities", () => {
    expect(
      holding([
        trade("b1", "buy", 100, 1000, 1),
        trade("s1", "sell", 100, 1000, 2),
        trade("b2", "buy", 0.5, 3000, 3),
      ]),
    ).toMatchObject({ quantity: 0.5, averagePurchasePrice: 3000 });
    expect(
      holding([
        trade("b1", "buy", 0.1, 1000, 1),
        trade("b2", "buy", 0.2, 2000, 2),
        trade("s1", "sell", 0.3, 1000, 3),
      ]),
    ).toBeUndefined();
  });

  it("keeps quantity with unknown prices and recovers after the unknown position is closed", () => {
    expect(holding([trade("b1", "buy", 100, null, 1)])).toMatchObject({
      quantity: 100,
      averagePurchasePrice: null,
      acquisitionAmount: null,
    });
    expect(
      holding([
        trade("b1", "buy", 100, null, 1),
        trade("s1", "sell", 100, 1000, 2),
        trade("b2", "buy", 50, 3000, 3),
      ]),
    ).toMatchObject({
      quantity: 50,
      averagePurchasePrice: 3000,
      currency: "JPY",
    });
  });

  it("retains an oversell warning and makes its price unknown", () => {
    expect(
      holding([
        trade("b1", "buy", 100, 1000, 1),
        trade("s1", "sell", 150, 1500, 2),
      ]),
    ).toMatchObject({
      quantity: -50,
      hasWarning: true,
      warningReason: "売買履歴上、保有数量を超える売却があります",
      averagePurchasePrice: null,
      acquisitionAmount: null,
    });
    expect(
      holding([
        trade("b1", "buy", 100, 1000, 1),
        trade("s1", "sell", 150, 1500, 2),
        trade("b2", "buy", 200, 2000, 3),
      ]),
    ).toMatchObject({
      quantity: 150,
      hasWarning: true,
      averagePurchasePrice: null,
    });
  });

  it("does not mix currencies, and does not infer a missing currency", () => {
    const mixed = holding([
      trade("b1", "buy", 1, 100, 1, { priceCurrency: "JPY" }),
      trade("b2", "buy", 1, 200, 2, { priceCurrency: "USD" }),
    ]);
    expect(mixed).toMatchObject({
      quantity: 2,
      averagePurchasePrice: null,
      acquisitionAmount: null,
      currency: null,
      hasWarning: true,
    });
    expect(
      holding([
        trade("b1", "buy", 1, 100, 1, { priceCurrency: "JPY" }),
        trade("b2", "buy", 1, 200, 2, { priceCurrency: "USD" }),
        trade("s1", "sell", 2, 150, 3),
        trade("b3", "buy", 1, 300, 4, { priceCurrency: "JPY" }),
      ]),
    ).toMatchObject({
      quantity: 1,
      averagePurchasePrice: 300,
      hasWarning: false,
    });
    expect(
      holding([trade("b1", "buy", 1, 100, 1, { priceCurrency: null })]),
    ).toMatchObject({
      quantity: 1,
      averagePurchasePrice: null,
      currency: null,
    });
  });

  it("sorts by execution date, creation date, then id regardless of input order", () => {
    const initialBuy = trade("initial-buy", "buy", 1, 100, 1, {
      createdAt: "2026-01-04T00:00:00.000Z",
    });
    const middleSale = trade("middle-sale", "sell", 1, 100, 2, {
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const laterExecution = trade("rebuy", "buy", 1, 300, 3);
    const createdAtTieBuy = trade("a-buy", "buy", 1, 100, 1, {
      createdAt: "2026-01-01T12:00:00.000Z",
    });
    const createdAtTieSell = trade("b-sell", "sell", 1, 100, 1, {
      createdAt: "2026-01-01T12:00:00.000Z",
    });
    expect(holding([createdAtTieSell, createdAtTieBuy])).toBeUndefined();
    expect(
      holding([
        {
          ...createdAtTieBuy,
          id: "z-buy",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          ...createdAtTieSell,
          id: "a-sell",
          createdAt: "2026-01-01T01:00:00.000Z",
        },
      ]),
    ).toBeUndefined();
    expect(holding([laterExecution, middleSale, initialBuy])).toMatchObject({
      quantity: 1,
      averagePurchasePrice: 300,
      hasWarning: false,
    });
  });

  it("keeps stock calculations separate and includes each canonical transaction once", () => {
    const other = { ...stock, id: "stock-2", name: "Other" };
    const result = calculatePortfolio(
      [
        trade("canonical", "buy", 10, 50, 1),
        trade("other-buy", "buy", 3, 20, 1, { stockId: other.id }),
      ],
      [stock, other],
    );
    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stockId: stock.id, quantity: 10 }),
        expect.objectContaining({ stockId: other.id, quantity: 3 }),
      ]),
    );
  });

  it("reflects transaction removal after an import is undone", () => {
    const imported = trade("csv-row", "buy", 10, 50, 1, {
      importBatchId: "batch-1",
    });
    expect(holding([imported])?.quantity).toBe(10);
    expect(calculatePortfolio([], [stock])).toEqual([]);
  });

  it("keeps a position unknown after a null-price buy even when partly sold", () => {
    expect(
      holding([
        trade("unknown-buy", "buy", 10, null, 1),
        trade("known-buy", "buy", 10, 100, 2),
        trade("unknown-price-sell", "sell", 5, null, 3),
      ]),
    ).toMatchObject({
      quantity: 15,
      averagePurchasePrice: null,
      acquisitionAmount: null,
      currency: "JPY",
    });
    expect(
      holding([
        trade("known-buy", "buy", 10, 100, 1),
        trade("unknown-price-sell", "sell", 5, null, 2),
      ]),
    ).toMatchObject({ quantity: 5, averagePurchasePrice: 100 });
  });

  it("combines transactions across brokers and account types", () => {
    expect(
      holding([
        trade("sbi-buy", "buy", 10, 100, 1, {
          sourceBroker: "sbi",
          accountType: "特定",
        }),
        trade("nomura-buy", "buy", 10, 200, 2, {
          sourceBroker: "nomura",
          accountType: "NISA",
        }),
      ]),
    ).toMatchObject({ quantity: 20, averagePurchasePrice: 150 });
  });

  it("preserves very small fractional quantities", () => {
    expect(holding([trade("tiny-buy", "buy", 1e-10, 10, 1)])).toMatchObject({
      quantity: 1e-10,
      averagePurchasePrice: 10,
    });
  });

  it("applies both Japanese stock splits before trades on the ex-date", () => {
    const furukawa = {
      ...stock,
      id: "furukawa",
      ticker: "5801",
      marketCode: "JP",
    };
    const softbank = {
      ...stock,
      id: "softbank",
      ticker: "9984",
      marketCode: "JP",
    };
    const result = calculatePortfolio(
      [
        trade("furukawa-buy", "buy", 3, 1000, 20, {
          stockId: furukawa.id,
          executedAt: "2026-06-20T00:00:00.000Z",
        }),
        trade("furukawa-ex-date-buy", "buy", 2, 100, 20, {
          stockId: furukawa.id,
          executedAt: "2026-06-29T00:00:00.000Z",
        }),
        trade("softbank-buy", "buy", 3, 4000, 20, {
          stockId: softbank.id,
          executedAt: "2025-12-20T00:00:00.000Z",
        }),
      ],
      [furukawa, softbank],
    );
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stockId: furukawa.id,
          quantity: 32,
          averagePurchasePrice: ((1000 / 10) * 30 + 100 * 2) / 32,
          adjustments: ["株式分割（1株→10株）を反映済み"],
        }),
        expect.objectContaining({
          stockId: softbank.id,
          quantity: 12,
          averagePurchasePrice: 1000,
          adjustments: ["株式分割（1株→4株）を反映済み"],
        }),
      ]),
    );
  });

  it("values Fujikura purchases across its six-for-one split without changing the acquisition amount", () => {
    const fujikura = {
      ...stock,
      id: "fujikura",
      ticker: "5803",
      marketCode: "JP",
    };
    const holdings = calculatePortfolio(
      [
        trade("before-split", "buy", 10, 6000, 20, {
          stockId: fujikura.id,
          executedAt: "2026-03-27T00:00:00.000Z",
        }),
        trade("ex-date-buy", "buy", 2, 1100, 20, {
          stockId: fujikura.id,
          executedAt: "2026-03-30T00:00:00.000Z",
        }),
      ],
      [fujikura],
    );
    expect(holdings[0]).toMatchObject({
      quantity: 62,
      acquisitionAmount: 62200,
      adjustments: ["株式分割（1株→6株）を反映済み"],
    });
    expect(holdings[0].averagePurchasePrice).toBeCloseTo(62200 / 62);

    const quote: MarketQuote = {
      symbol: "5803.T",
      price: 1200,
      currency: "JPY",
      priceAt: "2026-09-28T06:00:00.000Z",
      marketState: "REGULAR",
      delayedByMinutes: 15,
      sourceName: "Yahoo Finance",
    };
    expect(
      calculateValuation(holdings, new Map([["5803.T", quote]]))[0],
    ).toMatchObject({
      marketValue: 74400,
      unrealizedProfitLoss: 12200,
    });
  });

  it("preserves fractional split quantities and full acquisition amounts", () => {
    const furukawa = {
      ...stock,
      id: "furukawa",
      ticker: "5801",
      marketCode: "JP",
    };
    const result = calculatePortfolio(
      [
        trade("b1", "buy", 0.1, 100, 1, {
          stockId: furukawa.id,
          executedAt: "2026-06-20T00:00:00.000Z",
        }),
        trade("b2", "buy", 0.7, 100, 2, {
          stockId: furukawa.id,
          executedAt: "2026-06-21T00:00:00.000Z",
        }),
        trade("s1", "sell", 0.3, 100, 3, {
          stockId: furukawa.id,
          executedAt: "2026-06-22T00:00:00.000Z",
        }),
      ],
      [furukawa],
    );
    expect(result[0].quantity).toBeCloseTo(5);
    expect(
      calculatePortfolio(
        [
          trade("fractional-buy", "buy", 1.29, 100, 1, {
            stockId: furukawa.id,
            executedAt: "2026-06-26T00:00:00.000Z",
          }),
        ],
        [furukawa],
      )[0],
    ).toMatchObject({
      quantity: 12.9,
      averagePurchasePrice: 10,
      acquisitionAmount: 129,
    });
  });

  it("does not adjust US securities sharing a Japanese ticker and does not mutate transactions", () => {
    const usListed = {
      ...stock,
      id: "us-5801",
      ticker: "5801",
      marketCode: null,
      market: "US",
    };
    const tx = trade("us-buy", "buy", 3, 100, 20, {
      stockId: usListed.id,
      executedAt: "2026-06-20T00:00:00.000Z",
    });
    const original = structuredClone(tx);
    expect(calculatePortfolio([tx], [usListed])[0]).toMatchObject({
      quantity: 3,
      averagePurchasePrice: 100,
      adjustments: [],
    });
    expect(tx).toEqual(original);
  });

  it("distributes Sony Financial shares on the ex-date before same-day sales", () => {
    const sony = { ...stock, id: "sony", ticker: "6758", marketCode: "JP" };
    const result = calculatePortfolio(
      [
        trade("sony-buy", "buy", 5, 1000, 20, {
          stockId: sony.id,
          executedAt: "2025-09-20T00:00:00.000Z",
        }),
        trade("sony-ex-date-sell", "sell", 5, 800, 20, {
          stockId: sony.id,
          executedAt: "2025-09-29T00:00:00.000Z",
        }),
      ],
      [sony],
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      stockId: SONY_FINANCIAL_STOCK.id,
      quantity: 5,
      averagePurchasePrice: 206,
      adjustments: ["スピンオフ（親銘柄1株につき1株）を反映済み"],
    });
  });

  it("does not grant Sony Financial shares for a sale before the ex-date", () => {
    const sony = { ...stock, id: "sony", ticker: "6758", marketCode: "JP" };
    expect(
      calculatePortfolio(
        [
          trade("sony-buy", "buy", 5, 1000, 20, {
            stockId: sony.id,
            executedAt: "2025-09-20T00:00:00.000Z",
          }),
          trade("sony-before-ex-sale", "sell", 5, 800, 20, {
            stockId: sony.id,
            executedAt: "2025-09-28T14:59:59.000Z",
          }),
        ],
        [sony],
      ),
    ).toEqual([]);
  });

  it("uses the existing JP 8729 stock and merges its later trades chronologically", () => {
    const sony = { ...stock, id: "sony", ticker: "6758", marketCode: "JP" };
    const child = {
      ...SONY_FINANCIAL_STOCK,
      id: "real-8729",
      market: null,
    };
    const result = calculatePortfolio(
      [
        trade("sony-buy", "buy", 5, 1000, 20, {
          stockId: sony.id,
          executedAt: "2025-09-20T00:00:00.000Z",
        }),
        trade("child-buy", "buy", 5, 300, 20, {
          stockId: child.id,
          executedAt: "2025-09-29T00:01:00.000+09:00",
        }),
        trade("child-sell", "sell", 4, 350, 20, {
          stockId: child.id,
          executedAt: "2025-09-29T00:02:00.000+09:00",
        }),
      ],
      [sony, child],
    );
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stockId: child.id,
          quantity: 6,
          averagePurchasePrice: 253,
        }),
      ]),
    );
  });

  it("keeps prices unknown for spinoff entitlements with unknown parent cost", () => {
    const sony = { ...stock, id: "sony", ticker: "6758", marketCode: "JP" };
    const result = calculatePortfolio(
      [
        trade("sony-unknown-buy", "buy", 5, null, 20, {
          stockId: sony.id,
          executedAt: "2025-09-20T00:00:00.000Z",
        }),
      ],
      [sony],
    );
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stockId: SONY_FINANCIAL_STOCK.id,
          quantity: 5,
          averagePurchasePrice: null,
          acquisitionAmount: null,
          adjustments: expect.arrayContaining([
            "スピンオフ（親銘柄1株につき1株）を反映済み",
          ]),
        }),
      ]),
    );
  });

  it("does not infer spin-off shares after an oversell", () => {
    const sony = { ...stock, id: "sony", ticker: "6758", marketCode: "JP" };
    const result = calculatePortfolio(
      [
        trade("sony-buy", "buy", 5, 1000, 20, {
          stockId: sony.id,
          executedAt: "2025-09-20T00:00:00.000Z",
        }),
        trade("sony-oversell", "sell", 10, 1000, 20, {
          stockId: sony.id,
          executedAt: "2025-09-28T00:00:00.000Z",
        }),
      ],
      [sony],
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      stockId: sony.id,
      quantity: -5,
      hasWarning: true,
    });
  });

  it("warns when an existing child position uses a different currency", () => {
    const sony = { ...stock, id: "sony", ticker: "6758", marketCode: "JP" };
    const child = {
      ...SONY_FINANCIAL_STOCK,
      id: "real-8729",
      market: null,
    };
    const result = calculatePortfolio(
      [
        trade("sony-buy", "buy", 5, 1000, 20, {
          stockId: sony.id,
          executedAt: "2025-09-20T00:00:00.000Z",
        }),
        trade("child-usd-buy", "buy", 5, 300, 20, {
          stockId: child.id,
          priceCurrency: "USD",
          executedAt: "2025-09-29T00:01:00.000+09:00",
        }),
      ],
      [sony, child],
    );
    expect(
      result.find((holding) => holding.stockId === child.id),
    ).toMatchObject({
      quantity: 10,
      averagePurchasePrice: null,
      acquisitionAmount: null,
      currency: null,
      hasWarning: true,
      warningReason: "異なる通貨の取引が混在しています",
    });
  });

  it("scales oversold split quantities while retaining the warning", () => {
    const furukawa = {
      ...stock,
      id: "furukawa",
      ticker: "5801",
      marketCode: "JP",
    };
    expect(
      calculatePortfolio(
        [
          trade("buy", "buy", 3, 1000, 20, {
            stockId: furukawa.id,
            executedAt: "2026-06-20T00:00:00.000Z",
          }),
          trade("oversell", "sell", 5, 1000, 20, {
            stockId: furukawa.id,
            executedAt: "2026-06-25T00:00:00.000Z",
          }),
        ],
        [furukawa],
      )[0],
    ).toMatchObject({
      quantity: -20,
      hasWarning: true,
      averagePurchasePrice: null,
    });
  });
});
