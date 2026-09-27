import { describe, expect, it } from "vitest";
import {
  formatPortfolioAmount,
  formatPortfolioQuantity,
} from "@/features/portfolio/format";
import { calculatePortfolio } from "@/features/portfolio/portfolio";

describe("portfolio display precision", () => {
  it("discards fractional shares only for display and retains sub-share holdings", () => {
    expect(formatPortfolioQuantity(12.9)).toBe("12株");
    expect(formatPortfolioQuantity(0.5)).toBe("1株未満");
    expect(formatPortfolioQuantity(0)).toBe("0株");
    expect(formatPortfolioQuantity(-0.5)).toBe("-1株未満");
    expect(formatPortfolioQuantity(-12.9)).toBe("-12株");
    expect(formatPortfolioQuantity((0.1 + 0.7 - 0.3) * 10)).toBe("5株");
  });

  it("discards yen fractions and fractions below a USD cent without rounding up", () => {
    expect(formatPortfolioAmount(1234.99, "JPY")).toBe("1,234円");
    expect(formatPortfolioAmount(210.1299, "USD")).toBe("210.12 USD");
    expect(formatPortfolioAmount(1.15, "USD")).toBe("1.15 USD");
    expect(formatPortfolioAmount(0.3 * 3, "USD")).toBe("0.90 USD");
    expect(formatPortfolioAmount(0.009, "USD")).toBe("0.00 USD");
    expect(formatPortfolioAmount(null, "JPY")).toBe("不明");
    expect(formatPortfolioAmount(100, null)).toBe("不明");
  });

  it("calculates acquisition amounts from full precision before formatting", () => {
    const holdings = calculatePortfolio(
      [
        {
          id: "trade",
          stockId: "stock",
          side: "buy",
          quantity: 0.5,
          price: 210.1299,
          priceCurrency: "USD",
          fee: null,
          decisionId: null,
          executedAt: "2026-09-01T00:00:00.000Z",
          createdAt: "2026-09-01T00:00:00.000Z",
        },
      ],
      [{ id: "stock", name: "端数保有", ticker: "FRACTION", marketCode: "US" }],
    );
    expect(holdings).toHaveLength(1);
    const holding = holdings[0];
    expect(holding.quantity).toBe(0.5);
    expect(holding.averagePurchasePrice).toBe(210.1299);
    expect(holding.acquisitionAmount).toBeCloseTo(105.06495);
    expect(formatPortfolioQuantity(holding.quantity)).toBe("1株未満");
    expect(
      formatPortfolioAmount(holding.averagePurchasePrice, holding.currency),
    ).toBe("210.12 USD");
    expect(
      formatPortfolioAmount(holding.acquisitionAmount, holding.currency),
    ).toBe("105.06 USD");
  });
});
