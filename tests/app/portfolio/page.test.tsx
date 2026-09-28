import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PortfolioPage from "@/app/portfolio/page";
import type { PortfolioHolding } from "@/features/portfolio/portfolio";
import type { MarketQuote } from "@/features/market-data/provider";

const mocks = vi.hoisted(() => ({
  holdings: [] as PortfolioHolding[],
  quotes: new Map<string, MarketQuote>(),
}));

vi.mock("@/features/portfolio/actions", () => ({
  listPortfolioAction: async () => mocks.holdings,
}));

vi.mock("@/features/market-data/provider", () => ({
  yahooMarketPriceProvider: {
    getQuotes: async () => mocks.quotes,
  },
}));

function holding(overrides: Partial<PortfolioHolding> = {}): PortfolioHolding {
  return {
    stockId: "stock-1",
    stockName: "テスト銘柄",
    ticker: "7203",
    marketCode: "JP",
    quantity: 2,
    averagePurchasePrice: 1000,
    acquisitionAmount: 2000,
    currency: "JPY",
    hasWarning: false,
    warningReason: null,
    adjustments: [],
    ...overrides,
  };
}

function quote(overrides: Partial<MarketQuote> = {}): MarketQuote {
  return {
    symbol: "7203.T",
    price: 1200,
    currency: "JPY",
    priceAt: "2026-09-28T01:00:00.000Z",
    marketState: "REGULAR",
    delayedByMinutes: 15,
    sourceName: "Yahoo Finance",
    ...overrides,
  };
}

describe("portfolio page valuation UI", () => {
  beforeEach(() => {
    mocks.holdings = [holding()];
    mocks.quotes = new Map([["7203.T", quote()]]);
  });

  it("shows currency totals, an accessible allocation chart, and quote details", async () => {
    const markup = renderToStaticMarkup(await PortfolioPage());

    expect(markup).toContain("円建ての評価");
    expect(markup).toContain("ポートフォリオ概要");
    expect(markup).toContain("時価構成");
    expect(markup).toContain("保有銘柄");
    expect(markup).toContain("2,400円");
    expect(markup).toContain("+400円");
    expect(markup).toContain('role="img"');
    expect(markup).toContain("構成比の凡例");
    expect(markup).toContain("テスト銘柄");
    expect(markup).toContain("15分遅延");
  });

  it("keeps holdings visible and hides the chart when a quote is unavailable", async () => {
    mocks.quotes = new Map();

    const markup = renderToStaticMarkup(await PortfolioPage());

    expect(markup).toContain("テスト銘柄");
    expect(markup).toContain("取得できません");
    expect(markup).toContain("構成比を表示します");
    expect(markup).toContain("現在、参考株価を取得できません");
    expect(markup).not.toContain('role="img"');
  });
});
