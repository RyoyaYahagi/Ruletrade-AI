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
  it("returns no details when every transaction is a purchase", () => {
    expect(
      calculateRealizedProfitLoss(
        [
          trade("buy-1", "buy", 100, 1000, 1),
          trade("buy-2", "buy", 50, 1200, 2),
        ],
        [stock],
      ),
    ).toEqual({ details: [], byStock: [], byCurrency: [] });
  });

  it("calculates a partial sale from the weighted average cost", () => {
    const result = calculateRealizedProfitLoss(
      [
        trade("buy-1", "buy", 100, 1000, 1),
        trade("buy-2", "buy", 100, 2000, 2),
        trade("sell-1", "sell", 50, 2500, 3),
      ],
      [stock],
    );

    // Average cost = (100 * 1000 + 100 * 2000) / 200 = 1500.
    expect(result.details).toEqual([
      {
        transactionId: "sell-1",
        stockId: stock.id,
        executedAt: "2026-01-03T00:00:00.000Z",
        quantity: 50,
        sellPrice: 2500,
        averagePurchasePrice: 1500,
        realizedProfitLoss: 50 * (2500 - 1500),
        currency: "JPY",
        warning: null,
      },
    ]);
    expect(result.byStock).toEqual([
      {
        stockId: stock.id,
        currency: "JPY",
        realizedProfitLoss: 50000,
        calculatedCount: 1,
        totalCount: 1,
      },
    ]);
    expect(result.byCurrency).toEqual([
      {
        currency: "JPY",
        realizedProfitLoss: 50000,
        calculatedCount: 1,
        totalCount: 1,
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
      result.details.map(
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
    expect(result.byCurrency[0]).toMatchObject({
      realizedProfitLoss: 30000,
      calculatedCount: 2,
      totalCount: 2,
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
      expect(result.details[0]).toMatchObject({
        quantity: 6,
        sellPrice: 200,
        averagePurchasePrice: 100,
        realizedProfitLoss: 6 * (200 - 100),
        currency: "JPY",
        warning: null,
      });
      expect(result.byStock).toEqual([
        {
          stockId: furukawa.id,
          currency: "JPY",
          realizedProfitLoss: 600,
          calculatedCount: 1,
          totalCount: 1,
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

    expect(result.byStock).toEqual([
      {
        stockId: stock.id,
        currency: "JPY",
        realizedProfitLoss: 50 * (1200 - 1000),
        calculatedCount: 1,
        totalCount: 1,
      },
      {
        stockId: usdStock.id,
        currency: "USD",
        realizedProfitLoss: 5 * (120 - 100),
        calculatedCount: 1,
        totalCount: 1,
      },
    ]);
    expect(result.byCurrency).toEqual([
      {
        currency: "JPY",
        realizedProfitLoss: 10000,
        calculatedCount: 1,
        totalCount: 1,
      },
      {
        currency: "USD",
        realizedProfitLoss: 100,
        calculatedCount: 1,
        totalCount: 1,
      },
    ]);
    expect(result.byCurrency).toHaveLength(2);
  });

  it("ignores fees on both purchases and sales", () => {
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

    expect(result.details[0]).toMatchObject({
      averagePurchasePrice: 1000,
      sellPrice: 1200,
      realizedProfitLoss: 10 * (1200 - 1000),
    });
    expect(result.byCurrency[0].realizedProfitLoss).toBe(2000);
  });

  it("keeps an unknown-price sale with a warning and an incomplete total", () => {
    const result = calculateRealizedProfitLoss(
      [
        trade("buy", "buy", 10, 1000, 1),
        trade("sell-unknown-price", "sell", 5, null, 2),
      ],
      [stock],
    );

    expect(result.details).toEqual([
      {
        transactionId: "sell-unknown-price",
        stockId: stock.id,
        executedAt: "2026-01-02T00:00:00.000Z",
        quantity: 5,
        sellPrice: null,
        averagePurchasePrice: 1000,
        realizedProfitLoss: null,
        currency: "JPY",
        warning: "売却単価が不明なため実現損益を計算できません",
      },
    ]);
    expect(result.byStock[0]).toEqual({
      stockId: stock.id,
      currency: "JPY",
      realizedProfitLoss: null,
      calculatedCount: 0,
      totalCount: 1,
    });
    expect(result.byCurrency[0]).toEqual({
      currency: "JPY",
      realizedProfitLoss: null,
      calculatedCount: 0,
      totalCount: 1,
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
    expect(result.byStock[0]).toEqual({
      stockId: stock.id,
      currency: "JPY",
      realizedProfitLoss: null,
      calculatedCount: 1,
      totalCount: 2,
    });
    expect(result.byCurrency[0]).toEqual({
      currency: "JPY",
      realizedProfitLoss: null,
      calculatedCount: 1,
      totalCount: 2,
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

    expect(result.details[0]).toMatchObject({
      averagePurchasePrice: null,
      realizedProfitLoss: null,
      warning: "平均取得単価が不明なため実現損益を計算できません",
    });
    expect(result.byCurrency[0]).toMatchObject({
      realizedProfitLoss: null,
      calculatedCount: 0,
      totalCount: 1,
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

    expect(result.details).toEqual([
      {
        transactionId: "oversell",
        stockId: stock.id,
        executedAt: "2026-01-02T00:00:00.000Z",
        quantity: 15,
        sellPrice: 1200,
        averagePurchasePrice: 1000,
        realizedProfitLoss: null,
        currency: "JPY",
        warning: "売買履歴上、保有数量を超える売却があります",
      },
    ]);
    expect(result.byCurrency[0]).toEqual({
      currency: "JPY",
      realizedProfitLoss: null,
      calculatedCount: 0,
      totalCount: 1,
    });
  });

  it("nulls the whole sale when the sell currency differs from the holding", () => {
    const result = calculateRealizedProfitLoss(
      [
        trade("buy", "buy", 10, 1000, 1),
        trade("sell-in-usd", "sell", 5, 120, 2, {
          priceCurrency: "USD",
        }),
      ],
      [stock],
    );

    expect(result.details[0]).toMatchObject({
      sellPrice: 120,
      averagePurchasePrice: 1000,
      realizedProfitLoss: null,
      currency: "JPY",
      warning: "売却通貨が保有通貨と一致しないため実現損益を計算できません",
    });
    expect(result.byCurrency[0]).toEqual({
      currency: "JPY",
      realizedProfitLoss: null,
      calculatedCount: 0,
      totalCount: 1,
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

    expect(result.details[0]).toMatchObject({
      averagePurchasePrice: 100,
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

    expect(result.details[0]).toMatchObject({
      averagePurchasePrice: null,
      realizedProfitLoss: null,
      currency: null,
      warning: "保有通貨が不明なため実現損益を計算できません",
    });
    expect(result.byCurrency).toEqual([
      {
        currency: null,
        realizedProfitLoss: null,
        calculatedCount: 0,
        totalCount: 1,
      },
    ]);
  });

  it("filters details and totals by the inclusive execution period", () => {
    const transactions = [
      trade("buy", "buy", 100, 1000, 1),
      trade("sell-early", "sell", 10, 1100, 5, {
        executedAt: "2026-01-05T12:00:00.000Z",
      }),
      trade("sell-start", "sell", 20, 1200, 10, {
        executedAt: "2026-01-10T00:00:00.000Z",
      }),
      trade("sell-end", "sell", 5, 900, 15, {
        executedAt: "2026-01-15T00:00:00.000Z",
      }),
    ];

    const result = calculateRealizedProfitLoss(transactions, [stock], {
      from: "2026-01-10T00:00:00.000Z",
      to: "2026-01-15T00:00:00.000Z",
    });

    expect(result.details.map(({ transactionId }) => transactionId)).toEqual([
      "sell-start",
      "sell-end",
    ]);
    // Average cost stays 1000: 20 * (1200 - 1000) + 5 * (900 - 1000) = 3500.
    expect(result.byCurrency).toEqual([
      {
        currency: "JPY",
        realizedProfitLoss: 3500,
        calculatedCount: 2,
        totalCount: 2,
      },
    ]);

    expect(
      calculateRealizedProfitLoss(transactions, [stock], {
        from: "2026-01-05T12:00:00.000Z",
      }).details.map(({ transactionId }) => transactionId),
    ).toEqual(["sell-early", "sell-start", "sell-end"]);
    expect(
      calculateRealizedProfitLoss(transactions, [stock], {
        to: "2026-01-05T12:00:00.000Z",
      }).details.map(({ transactionId }) => transactionId),
    ).toEqual(["sell-early"]);
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
