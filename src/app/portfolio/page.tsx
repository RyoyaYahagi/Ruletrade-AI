import Link from "next/link";
import { listDecisionStatsAction } from "@/features/decisions/actions";
import { shortJapanDate } from "@/features/decisions/decision-display";

import { yahooMarketPriceProvider } from "@/features/market-data/provider";
import { toYahooSymbol } from "@/features/market-data/symbols";
import { listPortfolioAction } from "@/features/portfolio/actions";
import { formatPortfolioAmount } from "@/features/portfolio/format";
import { PortfolioAllocation } from "@/features/portfolio/components/portfolio-allocation";
import { PortfolioHoldingRow } from "@/features/portfolio/components/portfolio-holding-row";
import {
  calculateValuation,
  summarizeValuation,
  type ValuedHolding,
} from "@/features/portfolio/valuation";
import type { PortfolioHolding } from "@/features/portfolio/portfolio";

export const dynamic = "force-dynamic";

type Market = "jp" | "us";

function marketFor(holding: PortfolioHolding): Market | null {
  if (holding.marketCode === "JP") return "jp";
  if (holding.marketCode === "US") return "us";
  if (holding.currency === "JPY") return "jp";
  if (holding.currency === "USD") return "us";
  return null;
}

function sortValuations(a: ValuedHolding, b: ValuedHolding): number {
  if (a.marketValue === null && b.marketValue !== null) return 1;
  if (a.marketValue !== null && b.marketValue === null) return -1;
  if (
    a.marketValue !== null &&
    b.marketValue !== null &&
    a.marketValue !== b.marketValue
  ) {
    return b.marketValue - a.marketValue;
  }
  return a.holding.stockName.localeCompare(b.holding.stockName, "ja");
}

function Summary({
  market,
  summary,
  allocation,
}: {
  market: Market;
  summary: ReturnType<typeof summarizeValuation>["JPY"];
  allocation: React.ReactNode;
}) {
  const currency = market === "jp" ? "JPY" : "USD";
  const title =
    market === "jp" ? "国内株式ポートフォリオ" : "米国株式ポートフォリオ";
  const profit = summary.unrealizedProfitLoss;
  const profitClass =
    profit === null || profit === 0
      ? "text-muted-foreground"
      : profit > 0
        ? "text-primary"
        : "text-destructive";
  const signedProfit =
    profit === null
      ? "不明"
      : `${profit > 0 ? "+" : profit < 0 ? "-" : ""}${formatPortfolioAmount(Math.abs(profit), currency)}`;
  const signedRate =
    summary.unrealizedProfitLossRate === null
      ? "不明"
      : `${summary.unrealizedProfitLossRate > 0 ? "+" : summary.unrealizedProfitLossRate < 0 ? "-" : ""}${Math.abs(summary.unrealizedProfitLossRate).toLocaleString("ja-JP", { maximumFractionDigits: 2 })}%`;
  return (
    <section
      className="surface space-y-4 p-5"
      aria-labelledby="portfolio-summary-heading"
    >
      <h2 id="portfolio-summary-heading" className="sr-only">
        {title}
      </h2>
      <dl className="space-y-3.5">
        <div>
          <dt className="text-xs text-muted-foreground">時価評価額（参考）</dt>
          <dd className="mt-1 font-mono text-3xl tracking-tight">
            {summary.marketValue === null
              ? "一部未取得"
              : formatPortfolioAmount(summary.marketValue, currency)}
          </dd>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-xs text-muted-foreground">含み損益</dt>
            <dd className={`mt-1 font-mono text-[15px] ${profitClass}`}>
              {signedProfit} <span className="text-xs">({signedRate})</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">参考取得額</dt>
            <dd className="mt-1 font-mono text-[15px]">
              {summary.acquisitionAmount === null
                ? "不明"
                : formatPortfolioAmount(summary.acquisitionAmount, currency)}
            </dd>
          </div>
        </div>
      </dl>
      {!summary.completeness.profitLoss && (
        <p className="text-xs text-muted-foreground">
          一部の価格または取得額が不明なため、含み損益は完全な合計ではありません。
        </p>
      )}
      {allocation && <div className="border-t pt-4">{allocation}</div>}
    </section>
  );
}

function MarketTabs({
  market,
  jpCount,
  usCount,
}: {
  market: Market;
  jpCount: number;
  usCount: number;
}) {
  return (
    <nav aria-label="市場" className="grid grid-cols-2 border-b">
      {(
        [
          ["jp", "国内株式", jpCount],
          ["us", "米国株式", usCount],
        ] as const
      ).map(([key, label, count]) => (
        <Link
          key={key}
          href={`/portfolio?market=${key}`}
          aria-current={market === key ? "page" : undefined}
          className={`-mb-px flex min-h-12 items-center justify-center gap-1.5 border-b-[2.5px] text-sm ${market === key ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          {label} <span className="font-mono text-xs">{count}</span>
        </Link>
      ))}
    </nav>
  );
}

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ market?: string | string[] }>;
}) {
  const params = await searchParams;
  const market: Market = params.market === "us" ? "us" : "jp";
  const [holdings, stats] = await Promise.all([
    listPortfolioAction(),
    listDecisionStatsAction(),
  ]);
  const jpCount = holdings.filter(
    (holding) => holding.quantity > 0 && marketFor(holding) === "jp",
  ).length;
  const usCount = holdings.filter(
    (holding) => holding.quantity > 0 && marketFor(holding) === "us",
  ).length;
  const marketHoldings = holdings.filter(
    (holding) => marketFor(holding) === market,
  );
  const currentHoldings = marketHoldings.filter(
    (holding) => holding.quantity > 0,
  );
  const symbols = currentHoldings
    .map((holding) => toYahooSymbol(holding.ticker, holding.marketCode))
    .filter((symbol): symbol is string => symbol !== null);
  let quotes;
  try {
    quotes = await yahooMarketPriceProvider.getQuotes(symbols);
  } catch {
    quotes = new Map();
  }
  const valuedHoldings = calculateValuation(marketHoldings, quotes);
  const summary =
    summarizeValuation(valuedHoldings)[market === "jp" ? "JPY" : "USD"];
  const valuationByStockId = new Map(
    valuedHoldings.map((item) => [item.holding.stockId, item]),
  );
  const sortedCurrentHoldings = currentHoldings
    .map((holding) => valuationByStockId.get(holding.stockId)!)
    .sort(sortValuations);
  const warningHoldings = marketHoldings.filter(
    (holding) => holding.quantity <= 0 && holding.hasWarning,
  );
  const allQuotesUnavailable =
    currentHoldings.length > 0 &&
    sortedCurrentHoldings.every((item) => item.quote === null);

  const recordStat = (stockId: string) => {
    const stat = stats.get(stockId);
    return stat
      ? { count: stat.count, lastDecidedLabel: shortJapanDate(stat.lastDecidedOn) }
      : null;
  };
  const allocation =
    currentHoldings.length === 0 ? null : allQuotesUnavailable ? (
      <p className="text-sm text-muted-foreground" role="status">
        現在、参考株価を取得できません。保有情報は表示しています。
      </p>
    ) : summary.composition ? (
      <PortfolioAllocation summary={summary} />
    ) : (
      <p className="text-sm text-muted-foreground">
        価格データが揃わないため、構成比を表示できません。
      </p>
    );
  return (
    <main className="page-shell space-y-6">
      <div className="space-y-4">
        <h1 className="page-title">ポートフォリオ</h1>
        <MarketTabs market={market} jpCount={jpCount} usCount={usCount} />
      </div>
      <Summary market={market} summary={summary} allocation={allocation} />
      <section className="space-y-2" aria-labelledby="portfolio-holdings-heading">
        <h2 id="portfolio-holdings-heading" className="px-1 font-semibold">
          保有銘柄
        </h2>
        {sortedCurrentHoldings.length === 0 ? (
          <p className="surface p-5 text-sm text-muted-foreground">
            この市場で現在保有している銘柄はありません。
          </p>
        ) : (
          <ul className="surface divide-y overflow-hidden">
            {sortedCurrentHoldings.map((valuation) => (
              <PortfolioHoldingRow
                key={valuation.holding.stockId}
                valuation={valuation}
                recordStat={recordStat(valuation.holding.stockId)}
              />
            ))}
          </ul>
        )}
      </section>
      {warningHoldings.length > 0 && (
        <section className="space-y-2" aria-labelledby="portfolio-warnings-heading">
          <h2 id="portfolio-warnings-heading" className="px-1 font-semibold">
            売買履歴の確認が必要な銘柄
          </h2>
          <p className="px-1 text-sm text-muted-foreground">
            履歴上の保有数量に矛盾があります。自動修正は行っていません。
          </p>
          <ul className="surface divide-y overflow-hidden">
            {warningHoldings.map((holding) => (
              <PortfolioHoldingRow
                key={holding.stockId}
                valuation={valuationByStockId.get(holding.stockId)!}
                recordStat={recordStat(holding.stockId)}
              />
            ))}
          </ul>
        </section>
      )}
      <details className="px-1 text-sm leading-6 text-muted-foreground">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-foreground">
          算出方法と注意事項
        </summary>
        <div className="space-y-2">
          <p>
            時価評価額と含み損益は Yahoo Finance
            の参考価格を使って算出しています。価格は遅延する場合があり、表示時点での参考値です。
          </p>
          <p>
            参考平均購入単価と参考取得額は株式分割・スピンオフの調整後で、手数料を含みません。表示丸めのため、表示上の株数と単価の積が取得額と一致しない場合があります。
          </p>
          <p>
            現金補償は含みません。表示する取得額は税務上の取得価額ではありません。
          </p>
        </div>
      </details>
    </main>
  );
}
