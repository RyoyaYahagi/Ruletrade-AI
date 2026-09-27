import { CaptureForm } from "@/features/capture/capture-form";
import Link from "next/link";
import {
  listDueDecisionsAction,
  listRecentDecisionsAction,
  listStocksAction,
} from "@/features/decisions/actions";
import { formatPortfolioQuantity } from "@/features/portfolio/format";
import { listPortfolioAction } from "@/features/portfolio/actions";

export const dynamic = "force-dynamic";

const typeLabel: Record<string, string> = {
  buy: "購入",
  add: "買い増し",
  sell_consideration: "売却を検討",
  sell: "売却",
  thesis_update: "仮説の更新",
  note: "メモ",
};

function shortDate(date: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
  }).format(new Date(date));
}

export default async function HomePage() {
  const [dueItems, recentItems, stocks, portfolio] = await Promise.all([
    listDueDecisionsAction(),
    listRecentDecisionsAction({ limit: 5 }),
    listStocksAction(),
    listPortfolioAction(),
  ]);
  return (
    <main className="page-shell">
      <CaptureForm stocks={stocks} />
      {dueItems.length > 0 && (
        <section className="mt-10" aria-labelledby="due-heading">
          <h2 id="due-heading" className="text-lg font-semibold">
            レビュー時期です
          </h2>
          <div className="mt-3 divide-y rounded-2xl border bg-card">
            {dueItems.map(({ stock, decision }) => (
              <Link
                key={decision.id}
                href={`/stocks/${stock.id}?review=${decision.id}`}
                className="flex items-center justify-between gap-4 p-4 hover:bg-secondary/50"
              >
                <span>
                  <span className="block font-medium">{stock.name}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {decision.thesis ?? decision.rawInput}
                  </span>
                </span>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {decision.reviewAt
                    ? shortDate(decision.reviewAt)
                    : "振り返る"}{" "}
                  →
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
      <section className="mt-10" aria-labelledby="holdings-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 id="holdings-heading" className="text-lg font-semibold">
            現在の保有
          </h2>
          <Link
            href="/portfolio"
            className="shrink-0 text-sm font-medium text-primary hover:underline"
          >
            ポートフォリオを見る →
          </Link>
        </div>
        {portfolio.filter((holding) => holding.quantity > 0).length === 0 ? (
          <p className="mt-3 rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
            現在保有している銘柄はありません。
          </p>
        ) : (
          <div className="mt-3 divide-y rounded-2xl border bg-card">
            {portfolio
              .filter((holding) => holding.quantity > 0)
              .slice(0, 5)
              .map((holding) => (
                <Link
                  key={holding.stockId}
                  href={`/stocks/${holding.stockId}`}
                  className="flex min-w-0 items-center justify-between gap-3 p-4 hover:bg-secondary/50"
                >
                  <span className="min-w-0 truncate font-medium">
                    {holding.stockName}
                  </span>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {formatPortfolioQuantity(holding.quantity)}
                  </span>
                </Link>
              ))}
          </div>
        )}
      </section>
      <section className="mt-10" aria-labelledby="recent-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 id="recent-heading" className="text-lg font-semibold">
            最近の判断
          </h2>
          <Link
            href="/transactions"
            className="text-sm font-medium text-primary hover:underline"
          >
            売買履歴を見る
          </Link>
        </div>
        {recentItems.length === 0 ? (
          <p className="mt-3 rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
            記録はまだありません。上の入力欄から最初の判断を残せます。
          </p>
        ) : (
          <div className="mt-3 divide-y rounded-2xl border bg-card">
            {recentItems.map(({ stock, decision }) => (
              <Link
                key={decision.id}
                href={`/stocks/${stock.id}`}
                className="flex items-start justify-between gap-4 p-4 hover:bg-secondary/50"
              >
                <span className="min-w-0">
                  <span className="block font-medium">{stock.name}</span>
                  <span className="mt-1 block truncate text-sm text-muted-foreground">
                    {decision.thesis ?? decision.rawInput}
                  </span>
                </span>
                <span className="shrink-0 text-right text-sm text-muted-foreground">
                  <span className="block">{shortDate(decision.createdAt)}</span>
                  <span className="block">{typeLabel[decision.type]}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
