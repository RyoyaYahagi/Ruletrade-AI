import Link from "next/link";
import { Upload } from "lucide-react";
import { formatTransactionPrice } from "@/features/transactions/format";
import { japanDate } from "@/features/transactions/matching";
import {
  getStockTimelineAction,
  listStocksAction,
} from "@/features/decisions/actions";
import { listTransactionsAction } from "@/features/transactions/actions";
import type { Transaction } from "@/schemas/transaction";

export const dynamic = "force-dynamic";

function groupByMonth(transactions: Transaction[]) {
  const groups: Array<{ month: string; items: Transaction[] }> = [];
  for (const transaction of transactions) {
    const [year, month] = japanDate(transaction.executedAt).split("-");
    const label = `${year}年${Number(month)}月`;
    const last = groups.at(-1);
    if (last?.month === label) last.items.push(transaction);
    else groups.push({ month: label, items: [transaction] });
  }
  return groups;
}

export default async function TransactionsPage() {
  const [transactions, stocks] = await Promise.all([
    listTransactionsAction(),
    listStocksAction(),
  ]);
  const timelines = await Promise.all(
    stocks.map((stock) => getStockTimelineAction({ stockId: stock.id })),
  );
  const stockById = new Map(stocks.map((stock) => [stock.id, stock]));
  const decisionById = new Map(
    timelines.flatMap((timeline) =>
      timeline.decisions.map((decision) => [decision.id, decision] as const),
    ),
  );

  return (
    <main className="page-shell space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="page-title">売買履歴</h1>
        <Link
          href="/more"
          className="surface inline-flex min-h-11 shrink-0 items-center gap-1.5 px-3.5 text-sm font-semibold text-primary"
        >
          <Upload aria-hidden size={16} />
          CSVを取り込む
        </Link>
      </div>
      {transactions.length === 0 ? (
        <p className="surface p-5 text-sm text-muted-foreground">
          売買履歴はまだありません。証券会社のCSVを取り込むか、銘柄の記録から取引を追加できます。
        </p>
      ) : (
        groupByMonth(transactions).map(({ month, items }) => (
          <section key={month} className="space-y-2" aria-label={month}>
            <h2 className="px-1 font-mono text-sm text-muted-foreground">{month}</h2>
            <ol className="surface divide-y">
              {items.map((transaction) => {
                const stock = stockById.get(transaction.stockId);
                const decision = transaction.decisionId
                  ? decisionById.get(transaction.decisionId)
                  : undefined;
                return (
                  <li key={transaction.id} className="space-y-1.5 px-5 py-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <Link
                        href={`/stocks/${transaction.stockId}`}
                        className="font-semibold hover:underline"
                      >
                        {stock?.name ?? "銘柄"}
                      </Link>
                      <time
                        className="shrink-0 font-mono text-xs text-muted-foreground"
                        dateTime={transaction.executedAt}
                      >
                        {japanDate(transaction.executedAt).replaceAll("-", "/")}
                      </time>
                    </div>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-semibold ${transaction.side === "buy" ? "bg-accent text-accent-foreground" : "bg-muted"}`}
                      >
                        {transaction.side === "buy" ? "購入" : "売却"}
                      </span>
                      <span className="font-mono">
                        {transaction.quantity}株 ×{" "}
                        {formatTransactionPrice(
                          transaction.price,
                          transaction.priceCurrency,
                        )}
                      </span>
                      {transaction.fee !== null && (
                        <span className="text-xs text-muted-foreground">
                          手数料 {transaction.fee.toLocaleString("ja-JP")}
                          {transaction.feeCurrency === "USD" ? " USD" : "円"}
                        </span>
                      )}
                    </p>
                    {transaction.accountType && (
                      <p className="text-xs text-muted-foreground">
                        {transaction.accountType}
                      </p>
                    )}
                    {decision ? (
                      <Link
                        href={`/stocks/${transaction.stockId}#${decision.id}`}
                        className="mt-1 block rounded-xl bg-secondary/70 px-3 py-2.5 text-sm"
                      >
                        <span className="text-xs text-muted-foreground">判断メモ:</span>
                        <span className="journal-text mt-0.5 line-clamp-2 block">
                          「{decision.rawInput}」
                        </span>
                      </Link>
                    ) : (
                      <Link
                        href={`/stocks/${transaction.stockId}/capture?transactionId=${transaction.id}`}
                        className="mt-1 flex min-h-11 items-center justify-center rounded-xl border border-dashed border-attention/40 bg-attention-soft/60 text-sm font-semibold text-attention"
                      >
                        このときの理由を残す
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ))
      )}
    </main>
  );
}
