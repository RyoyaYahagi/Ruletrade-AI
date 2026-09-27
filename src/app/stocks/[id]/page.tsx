import { japanDate } from "@/features/transactions/matching";
import Link from "next/link";
import { DecisionLink } from "@/features/transactions/decision-link";
import { formatTransactionPrice } from "@/features/transactions/format";
import { notFound } from "next/navigation";
import { CompareForm } from "@/features/reviews/compare-form";
import { TransactionForm } from "@/features/transactions/transaction-form";
import {
  getStockTimelineAction,
  listReviewsForStockAction,
} from "@/features/decisions/actions";

export const dynamic = "force-dynamic";

export default async function StockPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ review?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  let data;
  let reviews;
  try {
    data = await getStockTimelineAction({ stockId: id });
    reviews = await listReviewsForStockAction({ stockId: id });
  } catch {
    notFound();
  }
  const decisionById = new Map(
    data.decisions.map((decision) => [decision.id, decision] as const),
  );
  const reviewDecision = data.decisions.find(
    (decision) => decision.id === query.review,
  );

  return (
    <main className="page-shell space-y-8">
      <div>
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← ホーム
        </Link>
        <p className="mt-5 text-sm font-medium text-primary">銘柄の記録</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          {data.stock.name}
        </h1>
        {data.stock.ticker && (
          <p className="mt-1 text-sm text-muted-foreground">
            {data.stock.ticker}
            {data.stock.market ? ` · ${data.stock.market}` : ""}
          </p>
        )}
      </div>

      <section aria-labelledby="timeline-heading">
        <div className="flex items-center justify-between gap-4">
          <h2 id="timeline-heading" className="text-xl font-semibold">
            判断タイムライン
          </h2>
          <Link
            href={`/stocks/${id}/capture`}
            className="text-sm font-medium text-primary hover:underline"
          >
            ＋ 判断を記録
          </Link>
        </div>
        {data.decisions.length === 0 ? (
          <p className="mt-3 rounded-xl border bg-card p-5 text-sm text-muted-foreground">
            この銘柄の判断メモはまだありません。
          </p>
        ) : (
          <ol className="mt-4 space-y-3 border-l border-primary/30 pl-4">
            {data.decisions.map((decision) => (
              <li
                id={decision.id}
                key={decision.id}
                className="surface relative p-4 sm:p-5"
              >
                <span
                  className="absolute -left-[1.32rem] top-5 h-3 w-3 rounded-full border-2 border-background bg-primary"
                  aria-hidden
                />
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold">
                    {
                      {
                        buy: "購入",
                        add: "買い増し",
                        sell_consideration: "売却を検討",
                        sell: "売却",
                        thesis_update: "仮説の更新",
                        note: "メモ",
                      }[decision.type]
                    }
                  </h3>
                  <time
                    className="text-sm text-muted-foreground"
                    dateTime={decision.decidedAt ?? decision.createdAt}
                  >
                    {japanDate(
                      decision.decidedAt ?? decision.createdAt,
                    ).replaceAll("-", "/")}
                  </time>
                </div>
                {data.transactions
                  .filter((trade) => trade.decisionId === decision.id)
                  .map((trade) => (
                    <p
                      key={trade.id}
                      className="mt-2 text-sm text-muted-foreground"
                    >
                      関連売買: {trade.side === "buy" ? "購入" : "売却"} ·{" "}
                      {trade.quantity}株 ×{" "}
                      {formatTransactionPrice(trade.price, trade.priceCurrency)}
                    </p>
                  ))}
                {decision.thesis && (
                  <p className="mt-3 text-sm leading-6">{decision.thesis}</p>
                )}
                {decision.assumptions.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-muted-foreground">
                      前提
                    </p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                      {decision.assumptions.map((text, index) => (
                        <li key={`${decision.id}-a-${index}`}>{text}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {decision.reviewConditions.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-muted-foreground">
                      見直し条件
                    </p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                      {decision.reviewConditions.map((text, index) => (
                        <li key={`${decision.id}-r-${index}`}>{text}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {decision.addConditions.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-muted-foreground">
                      買い増し条件
                    </p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                      {decision.addConditions.map((text, index) => (
                        <li key={`${decision.id}-x-${index}`}>{text}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <details className="mt-4 rounded-lg bg-secondary/50 p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    元の発言を見る
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                    {decision.rawInput}
                  </p>
                  {decision.followUpAnswer && (
                    <p className="mt-3 text-sm">
                      <span className="font-medium">追加質問への回答:</span>{" "}
                      {decision.followUpAnswer}
                    </p>
                  )}
                </details>
                {decision.reviewAt && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    振り返り予定:{" "}
                    {new Date(decision.reviewAt).toLocaleDateString("ja-JP")}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="trades-heading">
        <h2 id="trades-heading" className="text-xl font-semibold">
          売買履歴
        </h2>
        {data.transactions.length === 0 ? (
          <p className="mt-3 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
            売買履歴はまだありません。
          </p>
        ) : (
          <ul className="mt-3 divide-y rounded-xl border bg-card">
            {data.transactions.map((transaction) => (
              <li
                key={transaction.id}
                className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm"
              >
                <span>
                  <span className="font-medium">
                    {transaction.side === "buy" ? "購入" : "売却"}{" "}
                    {transaction.quantity}株
                  </span>
                  {transaction.decisionId &&
                    decisionById.get(transaction.decisionId) && (
                      <Link
                        href={`#${transaction.decisionId}`}
                        className="ml-2 text-primary hover:underline"
                      >
                        判断メモ:{" "}
                        {decisionById.get(transaction.decisionId)?.thesis ??
                          decisionById.get(transaction.decisionId)?.rawInput}
                      </Link>
                    )}
                </span>
                <span className="text-muted-foreground">
                  {japanDate(transaction.executedAt).replaceAll("-", "/")} ·{" "}
                  {formatTransactionPrice(
                    transaction.price,
                    transaction.priceCurrency,
                  )}
                </span>
                {transaction.accountType && (
                  <p className="w-full text-muted-foreground">
                    {transaction.accountType}
                  </p>
                )}
                <span className="text-muted-foreground">
                  {transaction.decisionId ? "判断あり" : "判断なし"}
                </span>
                {!transaction.decisionId && (
                  <Link
                    href={`/stocks/${id}/capture?transactionId=${transaction.id}`}
                    className="text-primary hover:underline"
                  >
                    判断を記録 →
                  </Link>
                )}
                <DecisionLink
                  id={transaction.id}
                  decisionId={transaction.decisionId}
                  decisions={data.decisions}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <TransactionForm stockId={data.stock.id} decisions={data.decisions} />
      <CompareForm stock={data.stock} reviewDecision={reviewDecision ?? null} />
      {reviews.length > 0 && (
        <section aria-labelledby="reviews-heading">
          <h2 id="reviews-heading" className="text-xl font-semibold">
            過去の振り返り
          </h2>
          <div className="mt-3 space-y-3">
            {reviews.map((review) => (
              <article key={review.id} className="surface p-4 sm:p-5">
                <time
                  className="text-sm text-muted-foreground"
                  dateTime={review.createdAt}
                >
                  {new Date(review.createdAt).toLocaleString("ja-JP", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </time>
                <h3 className="mt-2 font-medium">{review.summary}</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {review.differences.map((item, index) => (
                    <li key={`${review.id}-${index}`}>{item}</li>
                  ))}
                </ul>
                {review.reflection && (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                    {review.reflection}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
