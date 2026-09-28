import type { MarketQuote } from "@/features/market-data/provider";
import { toYahooSymbol } from "@/features/market-data/symbols";
import type { PortfolioHolding } from "@/features/portfolio/portfolio";

export type PortfolioCurrency = "JPY" | "USD";

export type ValuedHolding = {
  holding: PortfolioHolding;
  quote: MarketQuote | null;
  quoteError: string | null;
  marketValue: number | null;
  unrealizedProfitLoss: number | null;
  unrealizedProfitLossRate: number | null;
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
): ValuedHolding[] {
  return holdings.map((holding) => {
    const symbol = toYahooSymbol(holding.ticker, holding.marketCode);
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
