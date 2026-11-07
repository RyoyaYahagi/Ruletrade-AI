import { describe, expect, it, vi } from "vitest";
import type { Transaction } from "@/schemas/transaction";
import {
  calculateRealizedProfitLoss,
  type PortfolioStock,
} from "@/features/portfolio/portfolio";

const stock: PortfolioStock = {
  id: "stock-1",
  name: "Example Corp",
  ticker: "EX",
  marketCode: "JP",
};

const usdStock: PortfolioStock = {
  id: "stock-usd",
  name: "US Corp",
  ticker: "USX",
  marketCode: "US",
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

describe("calculateRealizedProfitLoss", () => {
  it("returns no sales when every transaction is a purchase", () => {
    expect(
      calculateRealizedProfitLoss(
        [
          trade("buy-1", "buy", 100, 1000, 1),
          trade("buy-2", "buy", 50, 1200, 2),
        ],
        [stock],
      ),
    ).toEqual({ sales: [], stockTotals: [], totalsByCurrency: [] });
  });

  it("calculates a partial sale from the weighted average cost", () => {
    const result = calculateRealizedProfitLoss(
      [
        trade("buy-1", "buy", 100, 1000, 1),
        trade("buy-2", "buy", 100, 2000, 2),
        trade("sell-1", "sell", 50, 2500, 3, {
          decisionId: "decision-1",
        }),
      ],
      [stock],
    );

    // Average cost = (100 * 1000 + 100 * 2000) / 200 = 1500.
    expect(result.sales).toEqual([
      {
        transactionId: "sell-1",
        stockId: stock.id,
        stockName: stock.name,
        ticker: stock.ticker,
        side: "sell",
        quantity: 50,
        executedAt: "2026-01-03T00:00:00.000Z",
        currency: "JPY",
        price: 2500,
        priceCurrency: "JPY",
        averagePurchasePrice: 1500,
        proceeds: 125000,
        costBasis: 75000,
        fee: null,
        feeCurrency: null,
        realizedProfitLoss: 50000,
        warning: null,
        decisionId: "decision-1",
      },
    ]);
    expect(result.stockTotals).toEqual([
      {
        stockId: stock.id,
        stockName: stock.name,
        ticker: stock.ticker,
        currency: "JPY",
        saleCount: 1,
        computedCount: 1,
        proceeds: 125000,
        costBasis: 75000,
        realizedProfitLoss: 50000,
        completeness: true,
      },
    ]);
    expect(result.totalsByCurrency).toEqual([
      {
        currency: "JPY",
        saleCount: 1,
        computedCount: 1,
        proceeds: 125000,
        costBasis: 75000,
        realizedProfitLoss: 50000,
        completeness: true,
      },
    ]);
  });

  it("resets the average cost after a full sale and uses the new cost on rebuy", () => {
    const result = calculateRealizedProfitLoss(
      [
        trade("buy-1", "buy", 100, 1000, 1),
        trade("sell-full", "sell", 100, 1200, 2),
        trade("buy-rebuy", "buy", 50, 3000, 3),
        trade("sell-rebuy", "sell", 20, 3500, 4),
      ],
      [stock],
    );

    expect(
      result.sales.map(
        ({ transactionId, averagePurchasePrice, realizedProfitLoss }) => ({
          transactionId,
          averagePurchasePrice,
          realizedProfitLoss,
        }),
      ),
    ).toEqual([
      {
        transactionId: "sell-full",
        averagePurchasePrice: 1000,
        realizedProfitLoss: 100 * (1200 - 1000),
      },
      {
        transactionId: "sell-rebuy",
        averagePurchasePrice: 3000,
        realizedProfitLoss: 20 * (3500 - 3000),
      },
    ]);
    expect(result.totalsByCurrency[0]).toMatchObject({
      saleCount: 2,
      computedCount: 2,
      realizedProfitLoss: 30000,
      completeness: true,
    });
  });

  it("uses the split-adjusted average cost for a sale after the ex-date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T00:00:00.000+09:00"));
    const furukawa = {
      ...stock,
      id: "furukawa",
      ticker: "5801",
      marketCode: "JP",
    };
    try {
      const result = calculateRealizedProfitLoss(
        [
          trade("buy-before-split", "buy", 10, 1000, 20, {
            stockId: furukawa.id,
            executedAt: "2026-06-20T00:00:00.000Z",
          }),
          trade("sell-after-split", "sell", 6, 200, 20, {
            stockId: furukawa.id,
            executedAt: "2026-06-30T00:00:00.000Z",
          }),
        ],
        [furukawa],
      );

      // 10 shares of 1000 become 100 shares of 100 after the 1:10 split.
      expect(result.sales[0]).toMatchObject({
        quantity: 6,
        price: 200,
        averagePurchasePrice: 100,
        proceeds: 1200,
        costBasis: 600,
        realizedProfitLoss: 600,
        currency: "JPY",
        warning: null,
      });
      expect(result.stockTotals).toEqual([
        {
          stockId: furukawa.id,
          stockName: furukawa.name,
          ticker: furukawa.ticker,
          currency: "JPY",
          saleCount: 1,
          computedCount: 1,
          proceeds: 1200,
          costBasis: 600,
          realizedProfitLoss: 600,
          completeness: true,
        },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps JPY and USD totals separate without converting them", () => {
    const result = calculateRealizedProfitLoss(
      [
        trade("jpy-buy", "buy", 100, 1000, 1),
        trade("jpy-sell", "sell", 50, 1200, 2),
        trade("usd-buy", "buy", 10, 100, 1, {
          stockId: usdStock.id,
          priceCurrency: "USD",
        }),
        trade("usd-sell", "sell", 5, 120, 2, {
          stockId: usdStock.id,
          priceCurrency: "USD",
        }),
      ],
      [stock, usdStock],
    );

    expect(result.stockTotals).toEqual([
      {
        stockId: stock.id,
        stockName: stock.name,
        ticker: stock.ticker,
        currency: "JPY",
        saleCount: 1,
        computedCount: 1,
        proceeds: 60000,
        costBasis: 50000,
        realizedProfitLoss: 10000,
        completeness: true,
      },
      {
        stockId: usdStock.id,
        stockName: usdStock.name,
        ticker: usdStock.ticker,
        currency: "USD",
        saleCount: 1,
        computedCount: 1,
        proceeds: 600,
        costBasis: 500,
        realizedProfitLoss: 100,
        completeness: true,
      },
    ]);
    expect(result.totalsByCurrency).toEqual([
      {
        currency: "JPY",
        saleCount: 1,
        computedCount: 1,
        proceeds: 60000,
        costBasis: 50000,
        realizedProfitLoss: 10000,
        completeness: true,
      },
      {
        currency: "USD",
        saleCount: 1,
        computedCount: 1,
        proceeds: 600,
        costBasis: 500,
        realizedProfitLoss: 100,
        completeness: true,
      },
    ]);
    expect(result.totalsByCurrency).toHaveLength(2);
  });

  it("returns fees as reference values without subtracting them", () => {
    const result = calculateRealizedProfitLoss(
      [
        trade("buy", "buy", 10, 1000, 1, {
          fee: 500,
          feeCurrency: "JPY",
        }),
        trade("sell", "sell", 10, 1200, 2, {
          fee: 300,
          feeCurrency: "JPY",
        }),
      ],
      [stock],
    );

    expect(result.sales[0]).toMatchObject({
      averagePurchasePrice: 1000,
      price: 1200,
      fee: 300,
      feeCurrency: "JPY",
      proceeds: 12000,
      costBasis: 10000,
      realizedProfitLoss: 10 * (1200 - 1000),
    });
    expect(result.totalsByCurrency[0].realizedProfitLoss).toBe(2000);
  });

  it("keeps an unknown-price sale with a warning and an incomplete total", () => {
    const result = calculateRealizedProfitLoss(
      [
        trade("buy", "buy", 10, 1000, 1),
        trade("sell-unknown-price", "sell", 5, null, 2),
      ],
      [stock],
    );

    expect(result.sales).toEqual([
      {
        transactionId: "sell-unknown-price",
        stockId: stock.id,
        stockName: stock.name,
        ticker: stock.ticker,
        side: "sell",
        quantity: 5,
        executedAt: "2026-01-02T00:00:00.000Z",
        currency: "JPY",
        price: null,
        priceCurrency: "JPY",
        averagePurchasePrice: 1000,
        proceeds: null,
        costBasis: 5000,
        fee: null,
        feeCurrency: null,
        realizedProfitLoss: null,
        warning: "売却単価が不明なため実現損益を計算できません",
        decisionId: null,
      },
    ]);
    expect(result.stockTotals[0]).toEqual({
      stockId: stock.id,
      stockName: stock.name,
      ticker: stock.ticker,
      currency: "JPY",
      saleCount: 1,
      computedCount: 0,
      proceeds: null,
      costBasis: null,
      realizedProfitLoss: null,
      completeness: false,
    });
    expect(result.totalsByCurrency[0]).toEqual({
      currency: "JPY",
      saleCount: 1,
      computedCount: 0,
      proceeds: null,
      costBasis: null,
      realizedProfitLoss: null,
      completeness: false,
    });
  });

  it("suppresses a total when any sale in the group is incomplete", () => {
    const result = calculateRealizedProfitLoss(
      [
        trade("buy", "buy", 10, 1000, 1),
        trade("sell-known", "sell", 5, 1200, 2),
        trade("sell-unknown-price", "sell", 2, null, 3),
      ],
      [stock],
    );

    // 5 * (1200 - 1000) = 1000 is calculable, but the second sale is not.
    expect(result.stockTotals[0]).toEqual({
      stockId: stock.id,
      stockName: stock.name,
      ticker: stock.ticker,
      currency: "JPY",
      saleCount: 2,
      computedCount: 1,
      proceeds: null,
      costBasis: null,
      realizedProfitLoss: null,
      completeness: false,
    });
    expect(result.totalsByCurrency[0]).toEqual({
      currency: "JPY",
      saleCount: 2,
      computedCount: 1,
      proceeds: null,
      costBasis: null,
      realizedProfitLoss: null,
      completeness: false,
    });
  });

  it("keeps a sale from an unknown-cost holding with a warning", () => {
    const result = calculateRealizedProfitLoss(
      [
        trade("buy-unknown", "buy", 10, null, 1),
        trade("sell", "sell", 5, 1200, 2),
      ],
      [stock],
    );

    expect(result.sales[0]).toMatchObject({
      averagePurchasePrice: null,
      proceeds: 6000,
      costBasis: null,
      realizedProfitLoss: null,
      warning: "平均取得単価が不明なため実現損益を計算できません",
    });
    expect(result.totalsByCurrency[0]).toMatchObject({
      saleCount: 1,
      computedCount: 0,
      realizedProfitLoss: null,
      completeness: false,
    });
  });

  it("nulls the whole oversold sale and reuses the existing warning", () => {
    const result = calculateRealizedProfitLoss(
      [
        trade("buy", "buy", 10, 1000, 1),
        trade("oversell", "sell", 15, 1200, 2),
      ],
      [stock],
    );

    expect(result.sales).toEqual([
      {
        transactionId: "oversell",
        stockId: stock.id,
        stockName: stock.name,
        ticker: stock.ticker,
        side: "sell",
        quantity: 15,
        executedAt: "2026-01-02T00:00:00.000Z",
        currency: "JPY",
        price: 1200,
        priceCurrency: "JPY",
        averagePurchasePrice: 1000,
        proceeds: 18000,
        costBasis: 15000,
        fee: null,
        feeCurrency: null,
        realizedProfitLoss: null,
        warning: "売買履歴上、保有数量を超える売却があります",
        decisionId: null,
      },
    ]);
    expect(result.totalsByCurrency[0]).toEqual({
      currency: "JPY",
      saleCount: 1,
      computedCount: 0,
      proceeds: null,
      costBasis: null,
      realizedProfitLoss: null,
      completeness: false,
    });
  });

  it("preserves sale proceeds but leaves profit unknown when currencies differ", () => {
    const result = calculateRealizedProfitLoss(
      [
        trade("buy", "buy", 10, 1000, 1),
        trade("sell-in-usd", "sell", 5, 120, 2, {
          priceCurrency: "USD",
        }),
      ],
      [stock],
    );

    expect(result.sales[0]).toMatchObject({
      price: 120,
      priceCurrency: "USD",
      averagePurchasePrice: 1000,
      proceeds: 600,
      costBasis: 5000,
      realizedProfitLoss: null,
      currency: "JPY",
      warning: "売却通貨が保有通貨と一致しないため実現損益を計算できません",
    });
    expect(result.totalsByCurrency[0]).toEqual({
      currency: "JPY",
      saleCount: 1,
      computedCount: 0,
      proceeds: null,
      costBasis: null,
      realizedProfitLoss: null,
      completeness: false,
    });
  });

  it("treats a missing sell currency as the holding currency", () => {
    const result = calculateRealizedProfitLoss(
      [
        trade("buy", "buy", 10, 100, 1, {
          stockId: usdStock.id,
          priceCurrency: "USD",
        }),
        trade("sell", "sell", 5, 120, 2, {
          stockId: usdStock.id,
          priceCurrency: undefined,
        }),
      ],
      [usdStock],
    );

    expect(result.sales[0]).toMatchObject({
      averagePurchasePrice: 100,
      priceCurrency: null,
      proceeds: 600,
      costBasis: 500,
      realizedProfitLoss: 5 * (120 - 100),
      currency: "USD",
      warning: null,
    });
  });

  it("warns when the holding currency is unknown", () => {
    const result = calculateRealizedProfitLoss(
      [
        trade("buy-unknown-currency", "buy", 10, 1000, 1, {
          priceCurrency: null,
        }),
        trade("sell", "sell", 5, 1200, 2, {
          priceCurrency: null,
        }),
      ],
      [stock],
    );

    expect(result.sales[0]).toMatchObject({
      averagePurchasePrice: null,
      proceeds: 6000,
      costBasis: null,
      realizedProfitLoss: null,
      currency: null,
      warning: "保有通貨が不明なため実現損益を計算できません",
    });
    expect(result.totalsByCurrency).toEqual([
      {
        currency: null,
        saleCount: 1,
        computedCount: 0,
        proceeds: null,
        costBasis: null,
        realizedProfitLoss: null,
        completeness: false,
      },
    ]);
  });

  it("filters sales and totals by inclusive JST execution days after replaying all history", () => {
    const transactions = [
      trade("buy", "buy", 100, 1000, 1),
      // 2026-01-04 23:59 JST: outside a from=2026-01-05 period.
      trade("sell-before", "sell", 1, 1000, 4, {
        executedAt: "2026-01-04T14:59:59.999Z",
      }),
      // 2026-01-05 00:00 JST: included at the lower boundary.
      trade("sell-start", "sell", 20, 1200, 5, {
        executedAt: "2026-01-04T15:00:00.000Z",
      }),
      // 2026-01-15 23:59:59.999 JST: included at the upper boundary.
      trade("sell-end", "sell", 5, 900, 15, {
        executedAt: "2026-01-15T14:59:59.999Z",
      }),
      // 2026-01-16 00:00 JST: outside a to=2026-01-15 period.
      trade("sell-after", "sell", 1, 900, 16, {
        executedAt: "2026-01-15T15:00:00.000Z",
      }),
    ];

    const result = calculateRealizedProfitLoss(transactions, [stock], {
      from: "2026-01-05",
      to: "2026-01-15",
    });

    expect(result.sales.map(({ transactionId }) => transactionId)).toEqual([
      "sell-start",
      "sell-end",
    ]);
    // Average cost stays 1000 from the pre-period purchase.
    // 20 * (1200 - 1000) + 5 * (900 - 1000) = 3500.
    expect(result.totalsByCurrency).toEqual([
      {
        currency: "JPY",
        saleCount: 2,
        computedCount: 2,
        proceeds: 28500,
        costBasis: 25000,
        realizedProfitLoss: 3500,
        completeness: true,
      },
    ]);

    expect(
      calculateRealizedProfitLoss(transactions, [stock], {
        from: "2026-01-05",
      }).sales.map(({ transactionId }) => transactionId),
    ).toEqual(["sell-start", "sell-end", "sell-after"]);
    expect(
      calculateRealizedProfitLoss(transactions, [stock], {
        to: "2026-01-05",
      }).sales.map(({ transactionId }) => transactionId),
    ).toEqual(["sell-before", "sell-start"]);
  });

  it("limits sales and totals to the requested stock without changing the cost replay", () => {
    const result = calculateRealizedProfitLoss(
      [
        trade("jpy-buy", "buy", 10, 1000, 1),
        trade("jpy-sell", "sell", 5, 1200, 2),
        trade("usd-buy", "buy", 10, 100, 1, {
          stockId: usdStock.id,
          priceCurrency: "USD",
        }),
        trade("usd-sell", "sell", 5, 120, 2, {
          stockId: usdStock.id,
          priceCurrency: "USD",
        }),
      ],
      [stock, usdStock],
      { stockId: usdStock.id },
    );

    expect(result.sales.map(({ transactionId }) => transactionId)).toEqual([
      "usd-sell",
    ]);
    expect(result.stockTotals.map(({ stockId }) => stockId)).toEqual([
      usdStock.id,
    ]);
    expect(result.totalsByCurrency).toEqual([
      {
        currency: "USD",
        saleCount: 1,
        computedCount: 1,
        proceeds: 600,
        costBasis: 500,
        realizedProfitLoss: 100,
        completeness: true,
      },
    ]);
  });

  it("includes fully sold stocks in the results", () => {
    const result = calculateRealizedProfitLoss(
      [
        trade("buy", "buy", 10, 1000, 1),
        trade("sell-all", "sell", 10, 1200, 2),
      ],
      [stock],
    );

    expect(result.sales).toHaveLength(1);
    expect(result.stockTotals[0]).toMatchObject({
      stockId: stock.id,
      saleCount: 1,
      realizedProfitLoss: 2000,
    });
  });

  it("throws for a sale whose stock is not in the stock list", () => {
    expect(() =>
      calculateRealizedProfitLoss(
        [
          trade("orphan-sell", "sell", 1, 100, 1, {
            stockId: "missing-stock",
          }),
        ],
        [stock],
      ),
    ).toThrow("Portfolio stock not found: missing-stock");
  });
});
