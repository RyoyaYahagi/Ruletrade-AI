import Link from "next/link";

import { listPortfolioAction } from "@/features/portfolio/actions";
import {
  formatPortfolioAmount,
  formatPortfolioQuantity,
} from "@/features/portfolio/format";
import type { PortfolioHolding } from "@/features/portfolio/portfolio";

export const dynamic = "force-dynamic";

function HoldingRow({ holding }: { holding: PortfolioHolding }) {
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
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">
        通貨: {holding.currency ?? "不明"}
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
  const currentHoldings = holdings.filter((holding) => holding.quantity > 0);
  const warningHoldings = holdings.filter(
    (holding) => holding.quantity <= 0 && holding.hasWarning,
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
        USD未満を切り捨てます。表示上の株数×単価と取得額は一致しない場合があります。現金補償は含みません。時価評価額や税務上の取得価額ではありません。
      </p>

      <section className="mt-6" aria-labelledby="portfolio-holdings-heading">
        <h2 id="portfolio-holdings-heading" className="sr-only">
          保有銘柄
        </h2>
        {currentHoldings.length === 0 ? (
          <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
            現在保有している銘柄はありません。
          </p>
        ) : (
          <ul className="divide-y rounded-2xl border bg-card">
            {currentHoldings.map((holding) => (
              <HoldingRow key={holding.stockId} holding={holding} />
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
              <HoldingRow key={holding.stockId} holding={holding} />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
