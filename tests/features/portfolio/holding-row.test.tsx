import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PortfolioHoldingRow } from "@/features/portfolio/components/portfolio-holding-row";
import type { PortfolioHolding } from "@/features/portfolio/portfolio";
import type { ValuedHolding } from "@/features/portfolio/valuation";

function valuedHolding(overrides: Partial<ValuedHolding> = {}): ValuedHolding {
  const holding: PortfolioHolding = {
    stockId: "stock-1",
    stockName: "長い銘柄名のテスト",
    ticker: "7203",
    marketCode: "JP",
    quantity: 2,
    averagePurchasePrice: 1000,
    acquisitionAmount: 2000,
    currency: "JPY",
    hasWarning: false,
    warningReason: null,
    adjustments: [],
  };
  return {
    holding,
    quote: {
      symbol: "7203.T",
      price: 1200,
      currency: "JPY",
      priceAt: "2026-09-28T01:00:00.000Z",
      marketState: "REGULAR",
      delayedByMinutes: 15,
      sourceName: "Yahoo Finance",
    },
    quoteError: null,
    marketValue: 2400,
    unrealizedProfitLoss: 400,
    unrealizedProfitLossRate: 20,
    ...overrides,
  };
}

describe("PortfolioHoldingRow", () => {
  it("renders compact valuation and a keyboard-operable disclosure control", () => {
    const markup = renderToStaticMarkup(
      <PortfolioHoldingRow valuation={valuedHolding()} />,
    );

    expect(markup).toContain("長い銘柄名のテスト");
    expect(markup).toContain("7203");
    expect(markup).toContain("2,400円");
    expect(markup).toContain("+400円 (+20.00%)");
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain("保有数量");
    expect(markup).not.toContain("Yahoo Finance");
  });

  it("keeps unavailable quotes readable and exposes the reason only on expansion", () => {
    const valuation = valuedHolding({
      quote: null,
      quoteError: "市場価格を取得できませんでした",
      marketValue: null,
      unrealizedProfitLoss: null,
      unrealizedProfitLossRate: null,
    });
    const markup = renderToStaticMarkup(
      <PortfolioHoldingRow valuation={valuation} />,
    );

    expect(markup).toContain(">不明</span>");
    expect(markup).toContain("損益 不明");
    expect(markup).not.toContain("市場価格を取得できませんでした");
  });
});
