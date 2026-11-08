import Link from "next/link";
import { listDecisionStatsAction } from "@/features/decisions/actions";
import { shortJapanDate } from "@/features/decisions/decision-display";

import type { ExchangeRate } from "@/features/market-data/exchange-rate";
import { marketPriceProvider } from "@/features/market-data/quotes";
import { toQuoteSymbol } from "@/features/market-data/symbols";
import {
  listPortfolioAction,
  listRealizedProfitLossAction,
} from "@/features/portfolio/actions";
import { loadBucketSummary } from "@/features/portfolio/bucket-data";
import { BucketAllocationPanel } from "@/features/portfolio/components/bucket-allocation-panel";
import { getAppSettings } from "@/features/settings/settings";
import { formatPortfolioAmount } from "@/features/portfolio/format";
import { PortfolioAllocation } from "@/features/portfolio/components/portfolio-allocation";
import { PortfolioHoldingRow } from "@/features/portfolio/components/portfolio-holding-row";
import {
  realizedProfitLossForCurrency,
  realizedProfitLossForStock,
} from "@/features/portfolio/portfolio";
import {
  calculateValuation,
  summarizeValuation,
  toYenValuation,
  totalInJpy,
  type JpyTotal,
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

function signedYen(value: number): string {
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}${formatPortfolioAmount(Math.abs(value), "JPY")}`;
}

function JpyTotalPanel({
  total,
  rate,
  rateRequired,
  unknownCurrencyHoldings,
}: {
  total: JpyTotal;
  rate: ExchangeRate | null;
  rateRequired: boolean;
  unknownCurrencyHoldings: number;
}) {
  const profit = total.unrealizedProfitLossJpy;
  const rateValue = total.unrealizedProfitLossRate;
  return (
    <section
      className="surface space-y-3 p-5"
      aria-labelledby="portfolio-total-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="portfolio-total-heading" className="font-semibold">
          全体（円換算）
        </h2>
        <span className="chip">国内株式＋米国株式</span>
      </div>
      <dl className="space-y-3">
        <div>
          <dt className="text-xs text-muted-foreground">時価評価額（参考）</dt>
          <dd className="mt-1 font-mono text-3xl tracking-tight">
            {total.marketValueJpy === null
              ? "算出できません"
              : formatPortfolioAmount(total.marketValueJpy, "JPY")}
          </dd>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-xs text-muted-foreground">含み損益</dt>
            <dd
              className={`mt-1 font-mono text-[15px] ${
                profit === null || profit === 0
                  ? "text-muted-foreground"
                  : profit > 0
                    ? "text-primary"
                    : "text-destructive"
              }`}
            >
              {profit === null ? "不明" : signedYen(profit)}{" "}
              <span className="text-xs">
                (
                {rateValue === null
                  ? "不明"
                  : `${rateValue > 0 ? "+" : rateValue < 0 ? "-" : ""}${Math.abs(rateValue).toLocaleString("ja-JP", { maximumFractionDigits: 2 })}%`}
                )
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">参考取得額</dt>
            <dd className="mt-1 font-mono text-[15px]">
              {total.acquisitionAmountJpy === null
                ? "不明"
                : formatPortfolioAmount(total.acquisitionAmountJpy, "JPY")}
            </dd>
          </div>
        </div>
      </dl>
      {rateRequired && rate === null && (
        <p className="text-xs text-muted-foreground">
          換算レートを取得できないため、米国株式を含む合計は出していません。古いレートは使いません。
        </p>
      )}
      {unknownCurrencyHoldings > 0 && (
        <p className="text-xs text-muted-foreground">
          通貨が不明な保有が{unknownCurrencyHoldings}
          件あるため、合計を出していません。
        </p>
      )}
      {rateRequired && rate !== null && (
        <p className="text-xs leading-5 text-muted-foreground">
          米ドル建ては 1 USD ={" "}
          {rate.rate.toLocaleString("ja-JP", { maximumFractionDigits: 2 })}
          円で換算しています。取得額も同じ現在のレートで換算するため、含み損益に為替の損益は含みません。
        </p>
      )}
    </section>
  );
}

function CurrencyToggle({
  showYen,
  yenRequested,
  rate,
}: {
  showYen: boolean;
  yenRequested: boolean;
  rate: number | null;
}) {
  const option =
    "flex min-h-9 items-center justify-center rounded-lg px-3 text-sm aria-[current=true]:bg-card aria-[current=true]:font-semibold aria-[current=true]:text-foreground aria-[current=true]:shadow-[0_1px_2px_rgb(23_32_27/0.08)]";
  return (
    <div className="space-y-1.5">
      <nav
        aria-label="表示通貨"
        className="grid w-fit grid-cols-2 gap-1 rounded-xl bg-secondary p-1 text-muted-foreground"
      >
        <Link
          href="/portfolio?market=us"
          scroll={false}
          aria-current={!showYen}
          className={option}
        >
          ドル
        </Link>
        {rate === null ? (
          <span className={`${option} cursor-not-allowed opacity-50`}>円</span>
        ) : (
          <Link
            href="/portfolio?market=us&display=jpy"
            scroll={false}
            aria-current={showYen}
            className={option}
          >
            円
          </Link>
        )}
      </nav>
      {showYen && rate !== null && (
        <p className="px-1 text-xs leading-5 text-muted-foreground">
          1 USD = {rate.toLocaleString("ja-JP", { maximumFractionDigits: 2 })}
          円で換算した参考値です。取得額と損益も同じ現在のレートで換算するため、為替の損益は含みません。
        </p>
      )}
      {rate === null && (
        <p className="px-1 text-xs text-muted-foreground">
          {yenRequested
            ? "換算レートを取得できないため、ドルで表示しています。"
            : "換算レートを取得できないため、円表示は使えません。"}
        </p>
      )}
    </div>
  );
}

function Summary({
  market,
  currency,
  summary,
  realizedProfitLoss,
  allocation,
}: {
  market: Market;
  currency: "JPY" | "USD";
  summary: ReturnType<typeof summarizeValuation>["JPY"];
  realizedProfitLoss: number | null;
  allocation: React.ReactNode;
}) {
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
  const signedRealized =
    realizedProfitLoss === null
      ? "不明"
      : `${realizedProfitLoss > 0 ? "+" : realizedProfitLoss < 0 ? "-" : ""}${formatPortfolioAmount(Math.abs(realizedProfitLoss), currency)}`;
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
        <div>
          <dt className="text-xs text-muted-foreground">
            実現損益（売却済み）
          </dt>
          <dd
            className={`mt-1 font-mono text-[15px] ${
              realizedProfitLoss === null || realizedProfitLoss === 0
                ? "text-muted-foreground"
                : realizedProfitLoss > 0
                  ? "text-primary"
                  : "text-destructive"
            }`}
          >
            {signedRealized}
          </dd>
        </div>
      </dl>
      {!summary.completeness.profitLoss && (
        <p className="text-xs text-muted-foreground">
          一部の価格または取得額が不明なため、含み損益は完全な合計ではありません。
        </p>
      )}
      {realizedProfitLoss === null && (
        <p className="text-xs text-muted-foreground">
          一部の売却価格または取得単価が不明なため、実現損益は表示できません。
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
  searchParams: Promise<{
    market?: string | string[];
    display?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const market: Market = params.market === "us" ? "us" : "jp";
  const [holdings, stats] = await Promise.all([
    listPortfolioAction(),
    listDecisionStatsAction(),
  ]);
  const [bucketSummary, settings, realized] = await Promise.all([
    loadBucketSummary(holdings),
    Promise.resolve(getAppSettings()),
    listRealizedProfitLossAction(),
  ]);
  const unknownCurrencySales =
    realized.totalsByCurrency.find((total) => total.currency === null)
      ?.saleCount ?? 0;
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
  // 円換算の合計は国内・米国の両方の保有を使うため、タブに関係なく全保有の価格を引く
  const heldHoldings = holdings.filter((holding) => holding.quantity > 0);
  const symbols = heldHoldings
    .map((holding) => toQuoteSymbol(holding))
    .filter((symbol): symbol is string => symbol !== null);
  let quotes;
  try {
    quotes = await marketPriceProvider.getQuotes(symbols);
  } catch {
    quotes = new Map();
  }
  const realizedByStock = new Map(
    holdings.map((holding) => [
      holding.stockId,
      realizedProfitLossForStock(realized, holding.stockId, holding.currency),
    ]),
  );
  const allValuedHoldings = calculateValuation(
    holdings,
    quotes,
    realizedByStock,
  );
  const valuedHoldings = allValuedHoldings.filter(
    ({ holding }) => marketFor(holding) === market,
  );
  const unknownCurrencyHoldings = heldHoldings.filter(
    (holding) => holding.currency === null,
  ).length;
  // 通貨が不明な保有があると円に換算できないため、一部だけの合計は出さない
  const jpyTotal: JpyTotal =
    unknownCurrencyHoldings > 0
      ? {
          marketValueJpy: null,
          acquisitionAmountJpy: null,
          unrealizedProfitLossJpy: null,
          unrealizedProfitLossRate: null,
        }
      : totalInJpy(
          summarizeValuation(allValuedHoldings),
          bucketSummary.exchangeRate?.rate ?? null,
        );
  const usdJpyRate = bucketSummary.exchangeRate?.rate ?? null;
  const yenRequested = market === "us" && params.display === "jpy";
  // 円表示は表示のための換算だけで、集計の元の値は米ドルのまま。レートが無ければ米ドルで出す
  const showYen = yenRequested && usdJpyRate !== null;
  const displayValuations = showYen
    ? valuedHoldings.map((item) => toYenValuation(item, usdJpyRate))
    : valuedHoldings;
  const currency = market === "jp" || showYen ? "JPY" : "USD";
  const summary = summarizeValuation(displayValuations)[currency];
  const nativeRealized = realizedProfitLossForCurrency(
    realized,
    market === "jp" ? "JPY" : "USD",
  );
  const realizedProfitLoss =
    showYen && nativeRealized !== null
      ? nativeRealized * usdJpyRate
      : nativeRealized;
  const valuationByStockId = new Map(
    displayValuations.map((item) => [item.holding.stockId, item]),
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
      ? {
          count: stat.count,
          lastDecidedLabel: shortJapanDate(stat.lastDecidedOn),
        }
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
        <JpyTotalPanel
          total={jpyTotal}
          rate={bucketSummary.exchangeRate}
          rateRequired={usCount > 0}
          unknownCurrencyHoldings={unknownCurrencyHoldings}
        />
        <BucketAllocationPanel summary={bucketSummary} settings={settings} />
        <MarketTabs market={market} jpCount={jpCount} usCount={usCount} />
      </div>
      {market === "us" && (
        <CurrencyToggle
          showYen={showYen}
          yenRequested={yenRequested}
          rate={usdJpyRate}
        />
      )}
      <Summary
        market={market}
        currency={currency}
        summary={summary}
        realizedProfitLoss={realizedProfitLoss}
        allocation={allocation}
      />
      {unknownCurrencySales > 0 && (
        <p className="text-sm text-attention">
          通貨が不明な売却が{unknownCurrencySales}
          件あります。この売却の実現損益は不明で、円・ドルの合計には含めていません。
        </p>
      )}
      <section
        id="holdings"
        className="scroll-mt-6 space-y-2"
        aria-labelledby="portfolio-holdings-heading"
      >
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
        <section
          className="space-y-2"
          aria-labelledby="portfolio-warnings-heading"
        >
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
            実現損益は売却ごとに「売却数量 ×（売却単価 −
            売却直前の移動平均取得単価）」で計算し、手数料・為替・決済額は含めません。売却価格や取得単価が不明な売却が1件でもある通貨の合計は「不明」と表示します。円とドルの換算・合算は行いません。
          </p>
          <p>
            現金補償は含みません。表示する取得額は税務上の取得価額ではありません。
          </p>
        </div>
      </details>
    </main>
  );
}
