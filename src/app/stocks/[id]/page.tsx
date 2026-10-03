import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { japanDate } from "@/features/transactions/matching";
import { DecisionLink } from "@/features/transactions/decision-link";
import { formatTransactionPrice } from "@/features/transactions/format";
import { TransactionForm } from "@/features/transactions/transaction-form";
import {
  decisionDisplayText,
  decisionTypeLabel,
  decisionTypeTagClass,
} from "@/features/decisions/decision-display";
import {
  getStockTimelineAction,
  listDueDecisionsAction,
  listReviewsForStockAction,
} from "@/features/decisions/actions";
import { listPortfolioAction } from "@/features/portfolio/actions";
import { formatPortfolioQuantity } from "@/features/portfolio/format";
import type { Decision } from "@/schemas/decision";

export const dynamic = "force-dynamic";

const tabs = [
  { id: "timeline", label: "タイムライン" },
  { id: "trades", label: "売買" },
  { id: "reviews", label: "振り返り" },
] as const;
type Tab = (typeof tabs)[number]["id"];

function slashDate(value: string) {
  return japanDate(value).replaceAll("-", "/");
}

function localeDate(value: string) {
  return new Date(value).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
}

function ConditionList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-ai">{label}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {items.map((text, index) => (
          <li key={`${label}-${index}`}>{text}</li>
        ))}
      </ul>
    </div>
  );
}

function DecisionCard({
  stockId,
  decision,
  due,
  linkedTrades,
}: {
  stockId: string;
  decision: Decision;
  due: boolean;
  linkedTrades: string[];
}) {
  const hasAiContent =
    Boolean(decision.summary ?? decision.thesis) ||
    (decision.points ?? []).length > 0 ||
    decision.assumptions.length > 0 ||
    decision.addConditions.length > 0 ||
    Boolean(decision.followUpQuestion && !decision.followUpAnswer);
  return (
    <article
      className={`surface space-y-3 p-4 sm:p-5 ${due ? "ring-[1.5px] ring-attention/40" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className={decisionTypeTagClass(decision.type)}>
          {decisionTypeLabel[decision.type]}
        </h3>
        {linkedTrades.map((text) => (
          <span key={text} className="text-xs text-muted-foreground">
            関連売買: {text}
          </span>
        ))}
      </div>
      <p className="journal-text whitespace-pre-wrap">{decision.rawInput}</p>
      {decision.followUpAnswer && (
        <div className="rounded-xl bg-secondary/60 p-3 text-sm">
          {decision.followUpQuestion && (
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-ai">AIからの確認:</span>{" "}
              {decision.followUpQuestion}
            </p>
          )}
          <p className="journal-text mt-1">
            <span className="sr-only">追加質問への回答: </span>
            {decision.followUpAnswer}
          </p>
        </div>
      )}
      {decision.reviewConditions.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="見直し条件">
          {decision.reviewConditions.map((text, index) => (
            <li key={`${decision.id}-r-${index}`} className="chip">
              見直し：{text}
            </li>
          ))}
        </ul>
      )}
      {hasAiContent && (
        <details className="group rounded-xl bg-ai-soft px-3 text-sm">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-semibold text-ai">
            AIによる整理
            <span className="font-medium group-open:hidden">開く</span>
            <span className="hidden font-medium group-open:inline">閉じる</span>
          </summary>
          <div className="space-y-3 pb-3 leading-7">
            {(decision.summary ?? decision.thesis) && (
              <div>
                <p className="text-xs font-semibold text-ai">要約</p>
                <p>{decisionDisplayText(decision)}</p>
              </div>
            )}
            {(decision.points ?? []).length > 0 && (
              <ConditionList
                label="あなたの発言から整理した点"
                items={decision.points!.map((point) => point.text)}
              />
            )}
            <ConditionList label="前提" items={decision.assumptions} />
            <ConditionList label="買い増し条件" items={decision.addConditions} />
            {decision.followUpQuestion && !decision.followUpAnswer && (
              <p>
                <span className="font-semibold text-ai">AIからの確認:</span>{" "}
                {decision.followUpQuestion}
              </p>
            )}
          </div>
        </details>
      )}
      {Boolean(decision.editHistory?.length) && (
        <details className="rounded-xl bg-secondary/60 px-3 text-sm">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium">
            編集履歴（{decision.editHistory?.length}件）
          </summary>
          <ol className="space-y-4 pb-3">
            {decision.editHistory?.map((edit, index) => (
              <li key={index}>
                <p className="font-medium">
                  {new Date(edit.editedAt).toLocaleString("ja-JP", {
                    timeZone: "Asia/Tokyo",
                  })}
                  の編集前
                </p>
                <p className="mt-1 text-muted-foreground">
                  判断した日:{" "}
                  {japanDate(edit.previous.decidedAt ?? edit.previous.createdAt)} ·
                  種類: {decisionTypeLabel[edit.previous.type]}
                </p>
                <p className="journal-text mt-2 whitespace-pre-wrap">
                  {edit.previous.rawInput}
                </p>
                {edit.previous.thesis && (
                  <p className="mt-2">投資仮説: {edit.previous.thesis}</p>
                )}
                {(
                  [
                    ["前提", edit.previous.assumptions],
                    ["見直し条件", edit.previous.reviewConditions],
                    ["買い増し条件", edit.previous.addConditions],
                  ] as const
                ).map(
                  ([label, items]) =>
                    Array.isArray(items) &&
                    items.length > 0 && (
                      <p key={label} className="mt-1">
                        {label}: {items.join("、")}
                      </p>
                    ),
                )}
                {Boolean(edit.previous.reviewDates?.length) && (
                  <p className="mt-1">
                    振り返り予定:{" "}
                    {edit.previous.reviewDates
                      ?.map((date) => japanDate(date))
                      .join("、")}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </details>
      )}
      {due && (
        <Link
          href={`/stocks/${stockId}/review?decision=${decision.id}`}
          className="flex min-h-11 items-center justify-center rounded-xl bg-attention-soft text-sm font-semibold text-attention"
        >
          振り返りの時期です · いまと比べる
        </Link>
      )}
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          {Boolean(decision.reviewDates?.length) &&
            `振り返り予定: ${decision.reviewDates?.map(localeDate).join("、")}`}
        </span>
        <Link
          href={`/stocks/${stockId}/decisions/${decision.id}/edit`}
          className="flex min-h-9 items-center font-medium text-primary"
        >
          編集
        </Link>
      </div>
    </article>
  );
}

export default async function StockPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const tab: Tab = tabs.some((item) => item.id === query.tab)
    ? (query.tab as Tab)
    : "timeline";
  let data;
  let reviews;
  try {
    data = await getStockTimelineAction({ stockId: id });
    reviews = await listReviewsForStockAction({ stockId: id });
  } catch {
    notFound();
  }
  const [portfolio, dueItems] = await Promise.all([
    listPortfolioAction(),
    listDueDecisionsAction(),
  ]);
  const holding = portfolio.find((item) => item.stockId === id);
  const dueIds = new Set(
    dueItems
      .filter((item) => item.stock.id === id)
      .map((item) => item.decision.id),
  );
  const now = new Date().toISOString();
  const nextReview = data.decisions
    .flatMap((decision) => decision.reviewDates ?? [])
    .filter((date) => date >= now)
    .sort()[0];
  const decisionById = new Map(
    data.decisions.map((decision) => [decision.id, decision] as const),
  );
  const tradeLabel = (trade: (typeof data.transactions)[number]) =>
    `${trade.side === "buy" ? "購入" : "売却"} ${trade.quantity}株`;
  const counts: Record<Tab, number | null> = {
    timeline: null,
    trades: data.transactions.length,
    reviews: reviews.length,
  };

  return (
    <main className="page-shell space-y-6">
      <div className="space-y-4">
        <Link
          href="/"
          className="-ml-1 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground"
        >
          <ArrowLeft aria-hidden size={18} />
          今日
        </Link>
        <div>
          <h1 className="page-title">{data.stock.name}</h1>
          {data.stock.ticker && (
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {data.stock.ticker}
              {data.stock.market ? ` · ${data.stock.market}` : ""}
            </p>
          )}
        </div>
        <dl className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-card px-3 py-2.5">
            <dt className="text-[11px] text-muted-foreground">保有</dt>
            <dd className="mt-0.5 font-mono">
              {holding && holding.quantity > 0
                ? formatPortfolioQuantity(holding.quantity)
                : "なし"}
            </dd>
          </div>
          <div className="rounded-xl bg-card px-3 py-2.5">
            <dt className="text-[11px] text-muted-foreground">記録</dt>
            <dd className="mt-0.5 font-mono">{data.decisions.length}件</dd>
          </div>
          {dueIds.size > 0 ? (
            <div className="rounded-xl bg-attention-soft px-3 py-2.5 text-attention">
              <dt className="text-[11px]">振り返り</dt>
              <dd className="mt-0.5 font-semibold">時期です</dd>
            </div>
          ) : (
            <div className="rounded-xl bg-card px-3 py-2.5">
              <dt className="text-[11px] text-muted-foreground">次の振り返り</dt>
              <dd className="mt-0.5 font-mono">
                {nextReview ? slashDate(nextReview).slice(5) : "未設定"}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <nav aria-label="表示の切り替え" className="grid grid-cols-3 border-b">
        {tabs.map((item) => (
          <Link
            key={item.id}
            href={item.id === "timeline" ? `/stocks/${id}` : `/stocks/${id}?tab=${item.id}`}
            scroll={false}
            aria-current={tab === item.id ? "page" : undefined}
            className="-mb-px flex min-h-12 items-center justify-center gap-1.5 border-b-[2.5px] border-transparent text-sm text-muted-foreground aria-[current=page]:border-primary aria-[current=page]:font-semibold aria-[current=page]:text-foreground"
          >
            {item.label}
            {counts[item.id] !== null && (
              <span className="font-mono text-xs">{counts[item.id]}</span>
            )}
          </Link>
        ))}
      </nav>

      {tab === "timeline" && (
        <section aria-labelledby="timeline-heading">
          <h2 id="timeline-heading" className="sr-only">
            判断タイムライン
          </h2>
          {data.decisions.length === 0 ? (
            <p className="surface p-5 text-sm text-muted-foreground">
              この銘柄の判断メモはまだありません。
            </p>
          ) : (
            <ol className="space-y-3.5">
              {[...data.decisions].reverse().map((decision) => {
                const decidedAt = decision.decidedAt ?? decision.createdAt;
                return (
                  <li
                    id={decision.id}
                    key={decision.id}
                    className="grid grid-cols-[2.75rem_1fr] gap-2.5"
                  >
                    <div className="flex flex-col items-center pt-4">
                      <time dateTime={decidedAt} className="text-center font-mono text-xs leading-5">
                        {slashDate(decidedAt).slice(5)}
                        <span className="block text-[10px] text-muted-foreground">
                          {slashDate(decidedAt).slice(0, 4)}
                        </span>
                      </time>
                      <span aria-hidden className="mt-2 w-0.5 flex-1 rounded bg-border" />
                    </div>
                    <DecisionCard
                      stockId={id}
                      decision={decision}
                      due={dueIds.has(decision.id)}
                      linkedTrades={data.transactions
                        .filter((trade) => trade.decisionId === decision.id)
                        .map(
                          (trade) =>
                            `${tradeLabel(trade)} × ${formatTransactionPrice(trade.price, trade.priceCurrency)}`,
                        )}
                    />
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}

      {tab === "trades" && (
        <section aria-labelledby="trades-heading" className="space-y-6">
          <h2 id="trades-heading" className="sr-only">
            売買履歴
          </h2>
          {data.transactions.length === 0 ? (
            <p className="surface p-5 text-sm text-muted-foreground">
              売買履歴はまだありません。
            </p>
          ) : (
            <ul className="surface divide-y">
              {data.transactions.map((transaction) => {
                const decision = transaction.decisionId
                  ? decisionById.get(transaction.decisionId)
                  : undefined;
                return (
                  <li key={transaction.id} className="space-y-2 px-5 py-4 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-semibold">{tradeLabel(transaction)}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {slashDate(transaction.executedAt)} ·{" "}
                        {formatTransactionPrice(transaction.price, transaction.priceCurrency)}
                      </span>
                    </div>
                    {transaction.accountType && (
                      <p className="text-xs text-muted-foreground">{transaction.accountType}</p>
                    )}
                    {decision ? (
                      <Link
                        href={`/stocks/${id}#${decision.id}`}
                        className="flex items-start gap-1.5 text-primary"
                      >
                        <Check aria-hidden size={16} className="mt-0.5 shrink-0" />
                        <span>判断メモ: {decisionDisplayText(decision)}</span>
                      </Link>
                    ) : (
                      <Link
                        href={`/stocks/${id}/capture?transactionId=${transaction.id}`}
                        className="flex min-h-11 items-center justify-center rounded-xl border border-dashed border-attention/40 bg-attention-soft/60 font-semibold text-attention"
                      >
                        このときの理由を残す
                      </Link>
                    )}
                    <details>
                      <summary className="flex min-h-9 cursor-pointer items-center text-xs text-muted-foreground">
                        紐付ける判断を変更
                      </summary>
                      <DecisionLink
                        id={transaction.id}
                        decisionId={transaction.decisionId}
                        decisions={data.decisions}
                      />
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
          <TransactionForm stockId={data.stock.id} decisions={data.decisions} />
        </section>
      )}

      {tab === "reviews" && (
        <section aria-labelledby="reviews-heading" className="space-y-3">
          <h2 id="reviews-heading" className="section-label">
            過去の振り返り
          </h2>
          {reviews.length === 0 ? (
            <p className="surface p-5 text-sm text-muted-foreground">
              振り返りはまだありません。「過去と比べる」から、いまの考えと過去の記録を並べられます。
            </p>
          ) : (
            reviews.map((review) => {
              const compared = review.decisionId
                ? decisionById.get(review.decisionId)
                : undefined;
              return (
                <article key={review.id} className="surface space-y-3 p-5">
                  <p className="font-mono text-xs text-muted-foreground">
                    <time dateTime={review.createdAt}>
                      {new Date(review.createdAt).toLocaleString("ja-JP", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                    {compared &&
                      ` · ${slashDate(compared.decidedAt ?? compared.createdAt).slice(5)} の${decisionTypeLabel[compared.type]}メモと比較`}
                  </p>
                  <div className="journal-text whitespace-pre-wrap text-[15px]">
                    <span className="sr-only">そのときの考え: </span>
                    {review.currentInput}
                  </div>
                  <div className="space-y-1.5 rounded-xl bg-ai-soft p-3.5 text-sm leading-7">
                    <h3 className="text-xs font-semibold text-ai">AIが整理した違い</h3>
                    <p>{review.summary}</p>
                    {review.differences.length > 0 && (
                      <ul className="list-disc space-y-1 pl-5">
                        {review.differences.map((item, index) => (
                          <li key={`${review.id}-${index}`}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {review.reflection && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">自分の振り返り</p>
                      <p className="journal-text mt-1 whitespace-pre-wrap text-[15px]">
                        {review.reflection}
                      </p>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </section>
      )}

      <div className="action-bar grid grid-cols-2 gap-3">
        <Link href={`/stocks/${id}/review`} className="button-outline">
          過去と比べる
        </Link>
        <Link href={`/stocks/${id}/capture`} className="button-primary">
          考えを記録
        </Link>
      </div>
    </main>
  );
}
