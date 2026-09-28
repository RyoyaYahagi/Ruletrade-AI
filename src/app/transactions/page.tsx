import Link from "next/link";
import { formatTransactionPrice } from "@/features/transactions/format";
import {
  getStockTimelineAction,
  listStocksAction,
} from "@/features/decisions/actions";
import { listTransactionsAction } from "@/features/transactions/actions";
import { decisionDisplayText } from "@/features/decisions/decision-display";

export const dynamic = "force-dynamic";

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
    <main className="page-shell">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← ホーム
      </Link>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight">売買履歴</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        記録した購入と売却を時系列で確認できます。
      </p>
      {transactions.length === 0 ? (
        <p className="mt-6 rounded-xl border bg-card p-5 text-sm text-muted-foreground">
          売買履歴はまだありません。銘柄詳細から取引を記録できます。
        </p>
      ) : (
        <ol className="mt-6 divide-y rounded-2xl border bg-card">
          {transactions.map((transaction) => {
            const stock = stockById.get(transaction.stockId);
            const decision = transaction.decisionId
              ? decisionById.get(transaction.decisionId)
              : undefined;
            return (
              <li key={transaction.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link
                    href={`/stocks/${transaction.stockId}`}
                    className="font-semibold hover:underline"
                  >
                    {stock?.name ?? "銘柄"}
                  </Link>
                  <time
                    className="text-sm text-muted-foreground"
                    dateTime={transaction.executedAt}
                  >
                    {new Date(transaction.executedAt).toLocaleDateString(
                      "ja-JP",
                    )}
                  </time>
                </div>
                <p className="mt-2 text-sm">
                  {transaction.side === "buy" ? "購入" : "売却"} ·{" "}
                  {transaction.quantity}株 ·{" "}
                  {formatTransactionPrice(
                    transaction.price,
                    transaction.priceCurrency,
                  )}
                  {transaction.fee !== null
                    ? ` · 手数料 ${transaction.fee.toLocaleString("ja-JP")}${transaction.feeCurrency === "USD" ? " USD" : "円"}`
                    : ""}
                </p>
                {transaction.accountType && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {transaction.accountType}
                  </p>
                )}
                {decision && (
                  <p className="mt-2 rounded-lg bg-secondary/50 p-3 text-sm">
                    <span className="font-medium">判断メモ:</span>{" "}
                    {decisionDisplayText(decision)}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
