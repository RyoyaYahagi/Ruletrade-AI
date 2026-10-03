import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  listDecisionStatsAction,
  listDueDecisionsAction,
  listRecentDecisionsAction,
  listStocksAction,
} from "@/features/decisions/actions";
import {
  decisionTypeLabel,
  decisionTypeTagClass,
  shortJapanDate,
} from "@/features/decisions/decision-display";
import { formatPortfolioQuantity } from "@/features/portfolio/format";
import { listPortfolioAction } from "@/features/portfolio/actions";
import { listTransactionsAction } from "@/features/transactions/actions";
import { japanDate } from "@/features/transactions/matching";

export const dynamic = "force-dynamic";

const UNLINKED_LIMIT = 3;

function todayLabel() {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date());
}

export default async function HomePage() {
  const [dueItems, recentItems, stocks, portfolio, transactions, stats] =
    await Promise.all([
      listDueDecisionsAction(),
      listRecentDecisionsAction({ limit: 5 }),
      listStocksAction(),
      listPortfolioAction(),
      listTransactionsAction(),
      listDecisionStatsAction(),
    ]);
  const stockById = new Map(stocks.map((stock) => [stock.id, stock]));
  const unlinked = transactions.filter((trade) => !trade.decisionId);
  const holdings = portfolio.filter((holding) => holding.quantity > 0);
  const today = japanDate();

  return (
    <main className="page-shell space-y-9">
      <header>
        <p className="font-mono text-xs tracking-wide text-muted-foreground">
          {todayLabel()}
        </p>
        <h1 className="page-title mt-0.5">今日</h1>
      </header>

      {dueItems.length > 0 && (
        <section className="space-y-3" aria-labelledby="due-heading">
          <h2 id="due-heading" className="flex items-center gap-2 px-1 font-semibold">
            振り返りの時期です
            <span className="rounded-full bg-attention-soft px-2 font-mono text-xs text-attention">
              {dueItems.length}
            </span>
          </h2>
          {dueItems.map(({ stock, decision }) => (
            <article key={decision.id} className="surface space-y-3 p-5">
              <div className="flex items-center justify-between gap-2">
                <Link href={`/stocks/${stock.id}`} className="font-semibold hover:underline">
                  {stock.name}
                  {stock.ticker && (
                    <span className="ml-2 font-mono text-xs font-medium text-muted-foreground">
                      {stock.ticker}
                    </span>
                  )}
                </Link>
                <span className="shrink-0 rounded-full bg-attention-soft px-2.5 py-1 text-xs font-medium text-attention">
                  {japanDate(decision.reviewAt!) === today
                    ? "今日"
                    : `予定日 ${shortJapanDate(decision.reviewAt!)}`}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {shortJapanDate(decision.decidedAt ?? decision.createdAt)} の
                {decisionTypeLabel[decision.type]}メモ
              </p>
              <p className="journal-text line-clamp-4">「{decision.rawInput}」</p>
              {decision.reviewConditions.length > 0 && (
                <ul className="flex flex-wrap gap-1.5" aria-label="見直し条件">
                  {decision.reviewConditions.slice(0, 3).map((condition, index) => (
                    <li key={`${decision.id}-${index}`} className="chip">
                      見直し：{condition}
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href={`/stocks/${stock.id}/review?decision=${decision.id}`}
                className="button-soft w-full"
              >
                いまの考えと比べる
                <ChevronRight aria-hidden size={18} />
              </Link>
            </article>
          ))}
        </section>
      )}

      {unlinked.length > 0 && (
        <section className="space-y-3" aria-labelledby="unlinked-heading">
          <h2 id="unlinked-heading" className="px-1 font-semibold">
            理由が残っていない売買
          </h2>
          <ul className="surface divide-y">
            {unlinked.slice(0, UNLINKED_LIMIT).map((trade) => (
              <li key={trade.id} className="flex items-center justify-between gap-3 py-2 pr-2 pl-5">
                <span className="py-2">
                  <span className="block font-semibold">
                    {stockById.get(trade.stockId)?.name ?? "銘柄"}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {shortJapanDate(trade.executedAt)}{" "}
                    {trade.side === "buy" ? "購入" : "売却"}{" "}
                    {formatPortfolioQuantity(trade.quantity)}
                  </span>
                </span>
                <Link
                  href={`/stocks/${trade.stockId}/capture?transactionId=${trade.id}`}
                  className="flex min-h-11 shrink-0 items-center rounded-xl px-3 text-sm font-semibold text-primary"
                >
                  理由を残す
                </Link>
              </li>
            ))}
          </ul>
          {unlinked.length > UNLINKED_LIMIT && (
            <Link href="/transactions" className="block px-1 text-sm font-medium text-primary">
              ほか {unlinked.length - UNLINKED_LIMIT} 件を売買で見る
            </Link>
          )}
        </section>
      )}

      <section className="space-y-3" aria-labelledby="holdings-heading">
        <div className="flex items-center justify-between gap-3 px-1">
          <h2 id="holdings-heading" className="font-semibold">
            保有している銘柄
          </h2>
          <Link href="/portfolio" className="text-sm font-medium text-primary">
            ポートフォリオを見る
          </Link>
        </div>
        {holdings.length === 0 ? (
          <p className="surface p-5 text-sm text-muted-foreground">
            現在保有している銘柄はありません。
          </p>
        ) : (
          <ul className="surface divide-y">
            {holdings.slice(0, 5).map((holding) => {
              const stat = stats.get(holding.stockId);
              return (
                <li key={holding.stockId}>
                  <Link
                    href={`/stocks/${holding.stockId}`}
                    className="flex min-w-0 items-center justify-between gap-3 px-5 py-3.5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{holding.stockName}</span>
                      {stat ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          最後の記録 {shortJapanDate(stat.lastDecidedOn)} · 記録 {stat.count}件
                        </span>
                      ) : (
                        <span className="mt-0.5 block text-xs text-attention">
                          理由の記録がありません
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-mono text-sm">
                      {formatPortfolioQuantity(holding.quantity)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="recent-heading">
        <h2 id="recent-heading" className="px-1 font-semibold">
          最近の記録
        </h2>
        {recentItems.length === 0 ? (
          <div className="surface space-y-3 p-5 text-sm text-muted-foreground">
            <p>記録はまだありません。</p>
            <Link href="/capture" className="button-primary w-full">
              最初の判断を記録する
            </Link>
          </div>
        ) : (
          <ul className="surface divide-y">
            {recentItems.map(({ stock, decision }) => (
              <li key={decision.id}>
                <Link href={`/stocks/${stock.id}#${decision.id}`} className="block space-y-1.5 px-5 py-3.5">
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-semibold">{stock.name}</span>
                      <span className={decisionTypeTagClass(decision.type)}>
                        {decisionTypeLabel[decision.type]}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {shortJapanDate(decision.decidedAt ?? decision.createdAt)}
                    </span>
                  </span>
                  <span className="journal-text line-clamp-2 block text-sm text-foreground/80">
                    「{decision.rawInput}」
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
