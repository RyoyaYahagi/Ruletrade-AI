import Link from "next/link";

import { yahooMarketPriceProvider } from "@/features/market-data/provider";
import { toYahooSymbol } from "@/features/market-data/symbols";
import { listPortfolioAction } from "@/features/portfolio/actions";
import {
  formatPortfolioAmount,
  formatPortfolioQuantity,
} from "@/features/portfolio/format";
import {
  calculateValuation,
  summarizeValuation,
  type ValuationSummary,
  type ValuedHolding,
} from "@/features/portfolio/valuation";
import type { PortfolioHolding } from "@/features/portfolio/portfolio";

export const dynamic = "force-dynamic";

const allocationColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function formatSignedAmount(
  value: number | null,
  currency: "JPY" | "USD" | null,
): string {
  if (value === null || currency === null) return "不明";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "±";
  return `${sign}${formatPortfolioAmount(Math.abs(value), currency)}`;
}

function formatPercent(value: number | null, signed = false): string {
  if (value === null) return "不明";
  const sign = signed ? (value > 0 ? "+" : value < 0 ? "−" : "±") : "";
  return `${sign}${Math.abs(value).toLocaleString("ja-JP", {
    maximumFractionDigits: 2,
  })}%`;
}

function formatPriceTime(value: string | null): string {
  if (value === null) return "時刻不明";
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

function AllocationChart({ summary }: { summary: ValuationSummary }) {
  const composition = summary.composition;
  if (!composition) return null;

  return (
    <div className="mt-5 grid items-center gap-5 sm:grid-cols-[8rem_1fr]">
      <svg
        viewBox="0 0 42 42"
        role="img"
        aria-label={`${summary.currency}建て保有銘柄の構成比`}
        className="mx-auto h-32 w-32 -rotate-90"
      >
        <circle
          cx="21"
          cy="21"
          r="15.915"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.08"
          strokeWidth="8"
        />
        {composition.map((item, index) => {
          const offset = composition
            .slice(0, index)
            .reduce((sum, previous) => sum + previous.percent, 0);
          return (
            <circle
              key={item.stockId}
              cx="21"
              cy="21"
              r="15.915"
              fill="none"
              stroke={allocationColors[index % allocationColors.length]}
              strokeWidth="8"
              strokeDasharray={`${item.percent} ${100 - item.percent}`}
              strokeDashoffset={-offset}
              pathLength="100"
            />
          );
        })}
      </svg>
      <ul aria-label="構成比の凡例" className="space-y-2 text-sm">
        {composition.map((item, index) => (
          <li
            key={item.stockId}
            className="flex items-center justify-between gap-4"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    allocationColors[index % allocationColors.length],
                }}
              />
              <span className="truncate">{item.stockName}</span>
            </span>
            <span className="shrink-0 tabular-nums">
              {formatPercent(item.percent)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SummaryCard({ summary }: { summary: ValuationSummary }) {
  return (
    <section
      className="surface p-5"
      aria-labelledby={`portfolio-${summary.currency}-summary`}
    >
      <h2
        id={`portfolio-${summary.currency}-summary`}
        className="text-lg font-semibold"
      >
        {summary.currency === "JPY" ? "円建て" : "ドル建て"}の評価
      </h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-muted-foreground">時価評価額</dt>
          <dd className="mt-1 font-semibold tabular-nums">
            {formatPortfolioAmount(summary.marketValue, summary.currency)}
            {!summary.completeness.marketValue && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                （一部未取得）
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">参考取得額</dt>
          <dd className="mt-1 font-semibold tabular-nums">
            {formatPortfolioAmount(summary.acquisitionAmount, summary.currency)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">含み損益</dt>
          <dd className="mt-1 font-semibold tabular-nums">
            {formatSignedAmount(summary.unrealizedProfitLoss, summary.currency)}
            {summary.unrealizedProfitLossRate !== null && (
              <span className="ml-2 text-sm font-medium">
                ({formatPercent(summary.unrealizedProfitLossRate, true)})
              </span>
            )}
            {!summary.completeness.profitLoss && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                （一部不明）
              </span>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function CompositionCard({ summary }: { summary: ValuationSummary }) {
  return (
    <section
      className="surface p-5"
      aria-labelledby={`portfolio-${summary.currency}-composition`}
    >
      <h3
        id={`portfolio-${summary.currency}-composition`}
        className="font-semibold"
      >
        {summary.currency === "JPY" ? "円建て" : "ドル建て"}
      </h3>
      {summary.composition ? (
        <AllocationChart summary={summary} />
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          保有銘柄すべての価格が揃うと、構成比を表示します。
        </p>
      )}
    </section>
  );
}

function HoldingRow({
  holding,
  valuation,
}: {
  holding: PortfolioHolding;
  valuation: ValuedHolding;
}) {
  const quote = valuation.quote;
  const quoteCurrency =
    quote?.currency === "JPY" || quote?.currency === "USD"
      ? quote.currency
      : null;

  return (
    <li className="p-4 sm:p-5">
      <Link
        href={`/stocks/${holding.stockId}`}
        className="block rounded-sm hover:underline"
      >
        <span className="block font-semibold">{holding.stockName}</span>
        <span className="mt-1 flex flex-wrap gap-x-2 text-sm text-muted-foreground">
          {holding.ticker && <span>{holding.ticker}</span>}
          {holding.marketCode && <span>{holding.marketCode}</span>}
          {!holding.ticker && !holding.marketCode && (
            <span>証券コード未登録</span>
          )}
        </span>
      </Link>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">
            {holding.quantity > 0 ? "現在保有数量" : "履歴上の数量"}
          </dt>
          <dd className="mt-0.5 font-medium">
            {formatPortfolioQuantity(holding.quantity)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">参考平均購入単価</dt>
          <dd className="mt-0.5 font-medium">
            {formatPortfolioAmount(
              holding.averagePurchasePrice,
              holding.currency,
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">参考取得額</dt>
          <dd className="mt-0.5 font-medium">
            {formatPortfolioAmount(holding.acquisitionAmount, holding.currency)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">参考株価</dt>
          <dd className="mt-0.5 font-medium">
            {quote && quoteCurrency
              ? formatPortfolioAmount(quote.price, quoteCurrency)
              : "取得できません"}
          </dd>
          {quote && (
            <dd className="mt-0.5 text-xs text-muted-foreground">
              {formatPriceTime(quote.priceAt)}
              {quote.priceAt !== null && " 時点"}
              {quote.delayedByMinutes !== null &&
                `・${quote.delayedByMinutes}分遅延`}
            </dd>
          )}
        </div>
        <div>
          <dt className="text-muted-foreground">時価評価額</dt>
          <dd className="mt-0.5 font-medium">
            {quoteCurrency
              ? formatPortfolioAmount(valuation.marketValue, quoteCurrency)
              : "不明"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">含み損益</dt>
          <dd className="mt-0.5 font-medium">
            {formatSignedAmount(
              valuation.unrealizedProfitLoss,
              holding.currency,
            )}
            {valuation.unrealizedProfitLossRate !== null && (
              <span className="ml-1">
                ({formatPercent(valuation.unrealizedProfitLossRate, true)})
              </span>
            )}
          </dd>
          {valuation.quoteError && (
            <dd className="mt-0.5 text-xs text-muted-foreground">
              {valuation.quoteError}
            </dd>
          )}
        </div>
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">
        通貨: {holding.currency ?? "不明"}
        {quote?.sourceName && `・価格情報: ${quote.sourceName}`}
        {quote?.marketState &&
          quote.marketState !== "REGULAR" &&
          `・市場状態: ${quote.marketState}`}
      </p>
      {holding.adjustments.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {holding.adjustments.map((adjustment) => (
            <li key={adjustment}>{adjustment}</li>
          ))}
        </ul>
      )}
      {holding.hasWarning && holding.warningReason && (
        <p
          className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
          role="status"
        >
          {holding.warningReason}
        </p>
      )}
    </li>
  );
}

export default async function PortfolioPage() {
  const holdings = await listPortfolioAction();
  const pricedHoldings = holdings.filter((holding) => holding.quantity > 0);
  const symbols = pricedHoldings
    .map((holding) => toYahooSymbol(holding.ticker, holding.marketCode))
    .filter((symbol): symbol is string => symbol !== null);
  let quotes;
  try {
    quotes = await yahooMarketPriceProvider.getQuotes(symbols);
  } catch {
    quotes = new Map();
  }
  const valuedHoldings = calculateValuation(holdings, quotes);
  const summaries = summarizeValuation(valuedHoldings);
  const valuationByStockId = new Map(
    valuedHoldings.map((item) => [item.holding.stockId, item]),
  );
  const currentHoldings = holdings.filter((holding) => holding.quantity > 0);
  const warningHoldings = holdings.filter(
    (holding) => holding.quantity <= 0 && holding.hasWarning,
  );
  const currentCurrencies = new Set(
    currentHoldings.flatMap((holding) => holding.currency ?? []),
  );
  const allQuotesUnavailable =
    currentHoldings.length > 0 &&
    valuedHoldings.every(
      ({ holding, quote }) => holding.quantity <= 0 || quote === null,
    );

  return (
    <main className="page-shell">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← ホーム
      </Link>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight">
        ポートフォリオ
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        売買履歴から計算した現在の保有銘柄です。参考平均購入単価と取得額は株式分割・スピンオフの調整後で、手数料を含まない参考値です。計算には小数を保持し、表示のみ株数は1株未満、金額は1円未満・0.01
        USD未満を切り捨てます。表示上の株数×単価と取得額は一致しない場合があります。現金補償は含みません。時価評価額と含み損益は表示された価格時点での参考値で、税務上の取得価額ではありません。
      </p>

      {currentHoldings.length > 0 && (
        <section className="mt-6" aria-labelledby="portfolio-overview-heading">
          <h2 id="portfolio-overview-heading" className="text-lg font-semibold">
            ポートフォリオ概要
          </h2>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            {(["JPY", "USD"] as const)
              .filter((currency) => currentCurrencies.has(currency))
              .map((currency) => (
                <SummaryCard key={currency} summary={summaries[currency]} />
              ))}
          </div>
          {currentHoldings.some((holding) => holding.currency === null) && (
            <p className="mt-2 text-sm text-muted-foreground">
              保有通貨が不明な銘柄は、通貨別の合計と時価構成に含めていません。
            </p>
          )}
        </section>
      )}

      {currentHoldings.length > 0 && (
        <section
          className="mt-6"
          aria-labelledby="portfolio-composition-heading"
        >
          <h2
            id="portfolio-composition-heading"
            className="text-lg font-semibold"
          >
            時価構成
          </h2>
          {allQuotesUnavailable && (
            <p className="mt-2 text-sm text-muted-foreground" role="status">
              現在、参考株価を取得できません。保有情報は表示しています。
            </p>
          )}
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            {(["JPY", "USD"] as const)
              .filter((currency) => currentCurrencies.has(currency))
              .map((currency) => (
                <CompositionCard key={currency} summary={summaries[currency]} />
              ))}
          </div>
        </section>
      )}

      <section className="mt-6" aria-labelledby="portfolio-holdings-heading">
        <h2 id="portfolio-holdings-heading" className="text-lg font-semibold">
          保有銘柄
        </h2>
        {currentHoldings.length === 0 ? (
          <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
            現在保有している銘柄はありません。
          </p>
        ) : (
          <ul className="divide-y rounded-2xl border bg-card">
            {currentHoldings.map((holding) => (
              <HoldingRow
                key={holding.stockId}
                holding={holding}
                valuation={valuationByStockId.get(holding.stockId)!}
              />
            ))}
          </ul>
        )}
      </section>

      {warningHoldings.length > 0 && (
        <section className="mt-10" aria-labelledby="portfolio-warnings-heading">
          <h2 id="portfolio-warnings-heading" className="text-lg font-semibold">
            売買履歴の確認が必要な銘柄
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            履歴上の保有数量に矛盾があります。自動修正は行っていません。
          </p>
          <ul className="mt-3 divide-y rounded-2xl border bg-card">
            {warningHoldings.map((holding) => (
              <HoldingRow
                key={holding.stockId}
                holding={holding}
                valuation={valuationByStockId.get(holding.stockId)!}
              />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
