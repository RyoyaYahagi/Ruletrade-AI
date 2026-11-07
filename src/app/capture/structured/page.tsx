import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { CaptureForm } from "@/features/capture/capture-form";
import { listStocksAction } from "@/features/decisions/actions";

export const dynamic = "force-dynamic";

export default async function StructuredCapturePage({
  searchParams,
}: {
  searchParams: Promise<{ stockId?: string }>;
}) {
  const [{ stockId }, stocks] = await Promise.all([
    searchParams,
    listStocksAction(),
  ]);
  const fixedStock = stockId
    ? stocks.find((stock) => stock.id === stockId)
    : undefined;
  if (stockId && !fixedStock) notFound();

  return (
    <main className="page-shell space-y-4">
      <Link
        href="/capture"
        className="-ml-1 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft aria-hidden size={18} />
        受け箱に戻る
      </Link>
      <CaptureForm stocks={stocks} fixedStock={fixedStock} />
    </main>
  );
}
