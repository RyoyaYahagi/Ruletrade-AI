import Link from "next/link";
import { notFound } from "next/navigation";
import { CaptureForm } from "@/features/capture/capture-form";
import { getStockTimelineAction } from "@/features/decisions/actions";

export const dynamic = "force-dynamic";

export default async function StockCapturePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ transactionId?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  let data;
  try {
    data = await getStockTimelineAction({ stockId: id });
  } catch {
    notFound();
  }
  const initialTransaction = query.transactionId
    ? data.transactions.find(
        (trade) => trade.id === query.transactionId && !trade.decisionId,
      )
    : undefined;
  if (query.transactionId && !initialTransaction) notFound();
  return (
    <main className="page-shell space-y-6">
      <Link
        href={`/stocks/${id}`}
        className="text-sm text-primary hover:underline"
      >
        ← {data.stock.name}の記録
      </Link>
      <CaptureForm
        stocks={[data.stock]}
        fixedStock={data.stock}
        transactions={data.transactions}
        initialTransaction={initialTransaction}
      />
    </main>
  );
}
