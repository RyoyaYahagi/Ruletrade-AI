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

async function render(market?: "jp" | "us") {
  return renderToStaticMarkup(
    await PortfolioPage({
      searchParams: Promise.resolve(market ? { market } : {}),
    }),
  );
}

describe("portfolio page valuation UI", () => {
  beforeEach(() => {
    mocks.holdings = [
      holding(),
      holding({
        stockId: "us-1",
        stockName: "米国テスト銘柄",
        ticker: "AAPL",
        marketCode: "US",
        currency: "USD",
        averagePurchasePrice: 100,
        acquisitionAmount: 200,
      }),
    ];
    mocks.quotes = new Map([
      ["7203.T", quote()],
      ["AAPL", quote({ symbol: "AAPL", price: 150, currency: "USD" })],
    ]);
  });

  it("defaults to domestic stocks and shows compact rows and selected-market totals", async () => {
    const markup = await render();

    expect(markup).toContain("国内株式ポートフォリオ");
    expect(markup).toMatch(/国内株式 <span[^>]*>1<\/span>/);
    expect(markup).toContain("時価評価額");
    expect(markup).toContain("2,400円");
    expect(markup).toContain("+400円");
    expect(markup).toContain("+20%");
    expect(markup).toContain("テスト銘柄");
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain("保有数量");
    expect(markup).not.toContain("米国テスト銘柄");
    expect(markup).toContain("算出方法と注意事項");
    expect(markup).not.toContain("15分遅延");
  });

  it("selects only US holdings when market=us", async () => {
    const markup = await render("us");

    expect(markup).toContain("米国株式ポートフォリオ");
    expect(markup).toContain("300.00 USD");
    expect(markup).toContain("米国テスト銘柄");
    expect(markup).not.toContain("7203");
  });

  it("keeps older holdings with a known currency when the market code is missing", async () => {
    mocks.holdings = [
      holding({
        stockId: "legacy-jp",
        stockName: "市場コード未登録銘柄",
        marketCode: null,
      }),
    ];
    mocks.quotes = new Map();

    const markup = await render();

    expect(markup).toContain("市場コード未登録銘柄");
    expect(markup).toContain("国内株式");
  });

  it("sorts priced holdings by market value and keeps unavailable quotes last", async () => {
    mocks.holdings = [
      holding({ stockId: "small", stockName: "小さい銘柄", ticker: "1001" }),
      holding({ stockId: "large", stockName: "大きい銘柄", ticker: "1002" }),
      holding({
        stockId: "missing",
        stockName: "価格なし銘柄",
        ticker: "1003",
      }),
    ];
    mocks.quotes = new Map([
      ["1001.T", quote({ symbol: "1001.T", price: 100 })],
      ["1002.T", quote({ symbol: "1002.T", price: 900 })],
    ]);

    const markup = await render();
    expect(
      markup.indexOf('aria-controls="holding-details-large"'),
    ).toBeLessThan(markup.indexOf('aria-controls="holding-details-small"'));
    expect(
      markup.indexOf('aria-controls="holding-details-small"'),
    ).toBeLessThan(markup.indexOf('aria-controls="holding-details-missing"'));
  });

  it("shows Top 5 holdings plus others in the allocation legend", async () => {
    mocks.holdings = Array.from({ length: 6 }, (_, index) =>
      holding({
        stockId: `stock-${index}`,
        stockName: `銘柄${index}`,
        ticker: `10${index}0`,
        acquisitionAmount: 100,
      }),
    );
    mocks.quotes = new Map(
      mocks.holdings.map((item, index) => {
        const symbol = `${item.ticker}.T`;
        return [symbol, quote({ symbol, price: 100 + index })];
      }),
    );

    const markup = await render();
    expect(markup).toContain("その他");
    expect(markup.match(/stroke-dasharray=/g)).toHaveLength(6);
    expect(markup.match(/aria-label="構成比の凡例"/g)).toHaveLength(1);
  });

  it("keeps rows when every quote is unavailable and reports missing prices", async () => {
    mocks.quotes = new Map();

    const markup = await render();

    expect(markup).toContain("テスト銘柄");
    expect(markup).toContain("現在、参考株価を取得できません");
    expect(markup).not.toContain('role="img"');
    expect(markup).not.toContain('role="img"');
  });
});
