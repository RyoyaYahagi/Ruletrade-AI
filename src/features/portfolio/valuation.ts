import type { MarketQuote } from "@/features/market-data/provider";
import { toQuoteSymbol } from "@/features/market-data/symbols";
import type { PortfolioHolding } from "@/features/portfolio/portfolio";

export type PortfolioCurrency = "JPY" | "USD";

export type ValuedHolding = {
  holding: PortfolioHolding;
  quote: MarketQuote | null;
  quoteError: string | null;
  marketValue: number | null;
  unrealizedProfitLoss: number | null;
  unrealizedProfitLossRate: number | null;
  realizedProfitLoss: number | null;
};

export type ValuationSummary = {
  currency: PortfolioCurrency;
  marketValue: number | null;
  acquisitionAmount: number | null;
  unrealizedProfitLoss: number | null;
  unrealizedProfitLossRate: number | null;
  composition: Array<{
    stockId: string;
    stockName: string;
    marketValue: number;
    percent: number;
  }> | null;
  completeness: {
    marketValue: boolean;
    acquisitionAmount: boolean;
    profitLoss: boolean;
    allocation: boolean;
  };
};

export type ValuationSummaries = Record<PortfolioCurrency, ValuationSummary>;

export function calculateValuation(
  holdings: readonly PortfolioHolding[],
  quotes: ReadonlyMap<string, MarketQuote>,
  realizedByStock: ReadonlyMap<string, number | null> = new Map(),
): ValuedHolding[] {
  return holdings.map((holding) => {
    const symbol = toQuoteSymbol(holding);
    const quote = symbol === null ? null : (quotes.get(symbol) ?? null);
    const marketValue = quote === null ? null : holding.quantity * quote.price;
    const currencyMatches =
      quote !== null &&
      holding.currency !== null &&
      quote.currency === holding.currency;
    const acquisitionAmount = holding.acquisitionAmount;
    const unrealizedProfitLoss =
      currencyMatches && marketValue !== null && acquisitionAmount !== null
        ? marketValue - acquisitionAmount
        : null;

    return {
      holding,
      quote,
      quoteError:
        symbol === null
          ? "市場価格を取得できる銘柄コードがありません"
          : quote === null
            ? "市場価格を取得できませんでした"
            : holding.currency === null
              ? "保有通貨が不明なため評価損益を計算できません"
              : !currencyMatches
                ? "通貨が一致しないため損益を計算できません"
                : null,
      marketValue,
      unrealizedProfitLoss,
      unrealizedProfitLossRate:
        unrealizedProfitLoss !== null &&
        acquisitionAmount !== null &&
        acquisitionAmount > 0
          ? (unrealizedProfitLoss / acquisitionAmount) * 100
          : null,
      realizedProfitLoss: realizedByStock.has(holding.stockId)
        ? (realizedByStock.get(holding.stockId) ?? null)
        : 0,
    };
  });
}

export function summarizeValuation(
  valuedHoldings: readonly ValuedHolding[],
): ValuationSummaries {
  const currencies: readonly PortfolioCurrency[] = ["JPY", "USD"];
  const totals = Object.fromEntries(
    currencies.map((currency) => {
      const group = valuedHoldings.filter(
        ({ holding }) => holding.quantity > 0 && holding.currency === currency,
      );
      const marketItems = group.filter(
        (
          item,
        ): item is ValuedHolding & {
          quote: MarketQuote;
          marketValue: number;
        } =>
          item.quote !== null &&
          item.quote.currency === currency &&
          item.marketValue !== null,
      );
      const marketComplete = marketItems.length === group.length;
      const acquisitionComplete = group.every(
        ({ holding }) => holding.acquisitionAmount !== null,
      );
      const profitComplete = group.every(
        ({ unrealizedProfitLoss }) => unrealizedProfitLoss !== null,
      );
      const marketValue = marketComplete
        ? marketItems.reduce((sum, item) => sum + item.marketValue, 0)
        : null;
      const acquisitionAmount = acquisitionComplete
        ? group.reduce(
            (sum, { holding }) => sum + holding.acquisitionAmount!,
            0,
          )
        : null;
      const unrealizedProfitLoss = profitComplete
        ? group.reduce((sum, item) => sum + item.unrealizedProfitLoss!, 0)
        : null;
      const allocationComplete = marketComplete && marketValue !== null;
      const composition =
        allocationComplete && marketValue > 0
          ? marketItems.map((item) => ({
              stockId: item.holding.stockId,
              stockName: item.holding.stockName,
              marketValue: item.marketValue,
              percent: (item.marketValue / marketValue) * 100,
            }))
          : null;

      return [
        currency,
        {
          currency,
          marketValue,
          acquisitionAmount,
          unrealizedProfitLoss,
          unrealizedProfitLossRate:
            profitComplete &&
            acquisitionAmount !== null &&
            acquisitionAmount > 0
              ? (unrealizedProfitLoss! / acquisitionAmount) * 100
              : null,
          composition,
          completeness: {
            marketValue: marketComplete,
            acquisitionAmount: acquisitionComplete,
            profitLoss: profitComplete,
            allocation: allocationComplete,
          },
        } satisfies ValuationSummary,
      ];
    }),
  ) as ValuationSummaries;

  for (const currency of currencies) {
    const summary = totals[currency];
    summary.completeness.allocation = summary.composition !== null;
  }

  return totals;
}

export type JpyTotal = {
  marketValueJpy: number | null;
  acquisitionAmountJpy: number | null;
  unrealizedProfitLossJpy: number | null;
  unrealizedProfitLossRate: number | null;
};

/**
 * 円と米ドルの集計を、ひとつの現在の為替レートで円に換算して合算する。
 * 取得額も買付時ではなく現在のレートで換算するため、含み損益に為替の損益は含まれない
 * （買付時のレートは取引記録に揃っていないので、推測で混ぜない）。
 * 米ドルの保有があるのにレートが無いときは、合計を出さずに null を返す。
 */
export function totalInJpy(
  summaries: ValuationSummaries,
  usdJpyRate: number | null,
): JpyTotal {
  const usd = summaries.USD;
  const hasUsd =
    usd.acquisitionAmount !== 0 ||
    (usd.marketValue !== null && usd.marketValue !== 0) ||
    !usd.completeness.marketValue;
  const rate = hasUsd ? usdJpyRate : 0;
  const combine = (jpy: number | null, usdValue: number | null) =>
    rate === null || jpy === null || (hasUsd && usdValue === null)
      ? null
      : jpy + (usdValue ?? 0) * rate;
  const marketValueJpy = combine(summaries.JPY.marketValue, usd.marketValue);
  const acquisitionAmountJpy = combine(
    summaries.JPY.acquisitionAmount,
    usd.acquisitionAmount,
  );
  const unrealizedProfitLossJpy = combine(
    summaries.JPY.unrealizedProfitLoss,
    usd.unrealizedProfitLoss,
  );
  return {
    marketValueJpy,
    acquisitionAmountJpy,
    unrealizedProfitLossJpy,
    unrealizedProfitLossRate:
      unrealizedProfitLossJpy !== null &&
      acquisitionAmountJpy !== null &&
      acquisitionAmountJpy > 0
        ? (unrealizedProfitLossJpy / acquisitionAmountJpy) * 100
        : null,
  };
}

/**
 * 米ドル建ての評価を、表示のためだけに円へ換算した写しを返す。円建てはそのまま返す。
 * 価格・取得額・損益をすべて同じ現在のレートで換算するので、損益率は変わらず、為替の損益は含まない。
 */
export function toYenValuation(
  valuation: ValuedHolding,
  usdJpyRate: number,
): ValuedHolding {
  const { holding, quote } = valuation;
  if (holding.currency !== "USD") return valuation;
  const yen = (value: number | null) =>
    value === null ? null : value * usdJpyRate;
  return {
    ...valuation,
    holding: {
      ...holding,
      currency: "JPY",
      averagePurchasePrice: yen(holding.averagePurchasePrice),
      acquisitionAmount: yen(holding.acquisitionAmount),
    },
    quote:
      quote === null || quote.currency !== "USD"
        ? quote
        : { ...quote, price: quote.price * usdJpyRate, currency: "JPY" },
    marketValue: yen(valuation.marketValue),
    unrealizedProfitLoss: yen(valuation.unrealizedProfitLoss),
    realizedProfitLoss: yen(valuation.realizedProfitLoss),
  };
}
