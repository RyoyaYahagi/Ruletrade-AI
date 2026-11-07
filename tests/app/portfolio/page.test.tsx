import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PortfolioPage from "@/app/portfolio/page";
import type {
  PortfolioHolding,
  RealizedProfitLossResult,
} from "@/features/portfolio/portfolio";
import type { MarketQuote } from "@/features/market-data/provider";
import type { BucketSummary } from "@/features/portfolio/bucket-summary";
import type { AppSettings } from "@/schemas/app-settings";

const emptyRealized: RealizedProfitLossResult = {
  sales: [],
  stockTotals: [],
  totalsByCurrency: [],
};

const mocks = vi.hoisted(() => ({
  holdings: [] as PortfolioHolding[],
  quotes: new Map<string, MarketQuote>(),
  realized: {
    sales: [],
    stockTotals: [],
    totalsByCurrency: [],
  } as RealizedProfitLossResult,
  bucketSummary: null as unknown as BucketSummary,
  settings: {
    id: "default",
    satelliteCapPct: null,
    satelliteWarnPct: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as AppSettings,
}));

vi.mock("@/features/portfolio/actions", () => ({
  listPortfolioAction: async () => mocks.holdings,
  listRealizedProfitLossAction: async () => mocks.realized,
}));

vi.mock("@/features/decisions/actions", () => ({
  listDecisionStatsAction: async () => new Map(),
}));

vi.mock("@/features/market-data/provider", () => ({
  yahooMarketPriceProvider: {
    getQuotes: async () => mocks.quotes,
  },
}));

vi.mock("@/features/portfolio/bucket-data", () => ({
  loadBucketSummary: async () => mocks.bucketSummary,
}));

vi.mock("@/features/settings/settings", () => ({
  getAppSettings: () => mocks.settings,
}));

function bucketTotals(
  bucket: "core" | "satellite" | "unclassified",
  investedJpy: number | null,
  marketValueJpy: number | null,
) {
  return {
    bucket,
    stockCount: 1,
    heldStockCount: 1,
    investedByCurrency: { JPY: investedJpy ?? 0, USD: 0 },
    investedJpy,
    marketValueByCurrency: { JPY: marketValueJpy ?? 0, USD: 0 },
    marketValueJpy,
    investedComplete: investedJpy !== null,
    marketValueComplete: marketValueJpy !== null,
  };
}

function bucketSummary(overrides: Partial<BucketSummary> = {}): BucketSummary {
  return {
    buckets: {
      core: bucketTotals("core", 0, 0),
      satellite: bucketTotals("satellite", 0, 0),
      unclassified: bucketTotals("unclassified", 0, 0),
    },
    totalInvestedJpy: 0,
    totalMarketValueJpy: 0,
    satelliteInvestedJpy: 0,
    satelliteInvestedPct: null,
    satelliteMarketValueJpy: 0,
    satelliteMarketValuePct: null,
    exchangeRate: null,
    rateRequired: false,
    rateUnavailable: false,
    includesUnclassified: false,
    coreRegistered: false,
    substitutedStockIds: [],
    substitutedStockNames: [],
    investedComplete: true,
    marketValueComplete: true,
    ...overrides,
  };
}

function holding(overrides: Partial<PortfolioHolding> = {}): PortfolioHolding {
  return {
    stockId: "stock-1",
    stockName: "テスト銘柄",
    ticker: "7203",
    marketCode: "JP",
    bucket: "unclassified",
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
    mocks.realized = emptyRealized;
    mocks.bucketSummary = bucketSummary();
    mocks.settings = {
      id: "default",
      satelliteCapPct: null,
      satelliteWarnPct: null,
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
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
  });

  it("shows realized profit/loss for the selected currency with the existing rounding", async () => {
    mocks.realized = {
      sales: [],
      stockTotals: [
        {
          stockId: "stock-1",
          stockName: "テスト銘柄",
          ticker: "7203",
          currency: "JPY",
          saleCount: 1,
          computedCount: 1,
          proceeds: 3000,
          costBasis: 2000,
          realizedProfitLoss: 1234.56,
          completeness: true,
        },
      ],
      totalsByCurrency: [
        {
          currency: "JPY",
          saleCount: 1,
          computedCount: 1,
          proceeds: 3000,
          costBasis: 2000,
          realizedProfitLoss: 1234.56,
          completeness: true,
        },
      ],
    };

    const markup = await render();

    expect(markup).toContain("実現損益（売却済み）");
    expect(markup).toContain("+1,234円");
  });

  it("shows unknown-currency sales instead of silently omitting them", async () => {
    mocks.realized = {
      sales: [],
      stockTotals: [],
      totalsByCurrency: [
        {
          currency: null,
          saleCount: 2,
          computedCount: 0,
          proceeds: null,
          costBasis: null,
          realizedProfitLoss: null,
          completeness: false,
        },
      ],
    };
    const markup = await render();
    expect(markup).toContain("通貨が不明な売却が2件あります");
    expect(markup).toContain("円・ドルの合計には含めていません");
  });

  it("shows invested ratio, unregistered core and unset cap without breaking", async () => {
    mocks.bucketSummary = bucketSummary({
      buckets: {
        core: bucketTotals("core", 0, 0),
        satellite: bucketTotals("satellite", 60000, 60000),
        unclassified: bucketTotals("unclassified", 40000, 40000),
      },
      totalInvestedJpy: 100000,
      totalMarketValueJpy: 100000,
      satelliteInvestedJpy: 100000,
      satelliteInvestedPct: 100,
      satelliteMarketValueJpy: 100000,
      satelliteMarketValuePct: 100,
      includesUnclassified: true,
      exchangeRate: {
        rate: 150,
        priceAt: "2026-11-07T05:21:16.000Z",
        sourceName: "Delayed Quote",
      },
    });

    const markup = await render();

    expect(markup).toContain("サテライト割合");
    expect(markup).toContain("100%");
    expect(markup).toContain(
      "コアに区分した銘柄がまだありません。割合はサテライトと未分類だけで計算しているため、残り枠は出していません。",
    );
    expect(markup).toContain("銘柄の区分を見る");
    expect(markup).toContain("未分類はサテライト側に数えています");
    expect(markup).toContain("1 USD = 150円");
    expect(markup).toContain("警告線 未設定");
    expect(markup).not.toContain("サテライトに足せる残り");
  });

  it("shows the remaining cap or the overage against the invested amount", async () => {
    mocks.settings = {
      ...mocks.settings,
      satelliteCapPct: 20,
    };
    mocks.bucketSummary = bucketSummary({
      totalInvestedJpy: 100000,
      satelliteInvestedJpy: 60000,
      satelliteInvestedPct: 60,
      satelliteMarketValuePct: 60,
      coreRegistered: true,
    });

    const over = await render();

    expect(over).toContain("上限を超えている額");
    expect(over).toContain("40,000円");
    expect(over).toContain("上限 20%（20,000円）に対して現在 60%");

    mocks.settings = { ...mocks.settings, satelliteCapPct: 70 };
    const under = await render();

    expect(under).toContain("サテライトに足せる残り");
    expect(under).toContain("10,000円");
    expect(under).toContain("上限 70%（70,000円）まで · 現在 60%");
  });

  it("asks for a cap instead of showing the remaining amount when the cap is unset", async () => {
    mocks.bucketSummary = bucketSummary({
      totalInvestedJpy: 100000,
      satelliteInvestedJpy: 60000,
      satelliteInvestedPct: 60,
      satelliteMarketValuePct: 60,
      coreRegistered: true,
    });

    const markup = await render();

    expect(markup).toContain("上限が未設定のため、残り枠は出していません。");
    expect(markup).toContain('href="/more#bucket-settings"');
  });

  it("does not show a ratio when the exchange rate is unavailable", async () => {
    mocks.bucketSummary = bucketSummary({
      totalInvestedJpy: null,
      satelliteInvestedJpy: null,
      satelliteInvestedPct: null,
      satelliteMarketValuePct: null,
      rateRequired: true,
      rateUnavailable: true,
    });

    const markup = await render();

    expect(markup).toContain(
      "USD建ての銘柄があり、換算レートを取得できなかったため、円換算の割合と残り枠を出していません。古いレートは使いません。",
    );
    expect(markup).toContain("算出できません");
  });

  it("highlights the market ratio when it exceeds the warning line", async () => {
    mocks.settings = {
      ...mocks.settings,
      satelliteWarnPct: 40,
    };
    mocks.bucketSummary = bucketSummary({
      totalInvestedJpy: 100000,
      satelliteInvestedPct: 30,
      satelliteMarketValuePct: 50,
      satelliteMarketValueJpy: 50000,
    });

    const markup = await render();

    expect(markup).toContain("警告線を超えています");
    expect(markup).toContain("50% / 40%");
    expect(markup).toContain(
      "時価ベースのサテライト割合です。上限の判定には使いません。",
    );
  });

  it("marks realized profit/loss as unknown when a sale cannot be calculated", async () => {
    mocks.realized = {
      sales: [],
      stockTotals: [
        {
          stockId: "stock-1",
          stockName: "テスト銘柄",
          ticker: "7203",
          currency: "JPY",
          saleCount: 1,
          computedCount: 0,
          proceeds: null,
          costBasis: null,
          realizedProfitLoss: null,
          completeness: false,
        },
      ],
      totalsByCurrency: [
        {
          currency: "JPY",
          saleCount: 1,
          computedCount: 0,
          proceeds: null,
          costBasis: null,
          realizedProfitLoss: null,
          completeness: false,
        },
      ],
    };

    const markup = await render();

    expect(markup).toContain("一部の売却価格または取得単価が不明");
    expect(markup).toContain("不明");
  });
});
