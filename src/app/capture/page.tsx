import Link from "next/link";
import { X } from "lucide-react";

import { InboxCaptureForm } from "@/features/capture/inbox-capture-form";
import { listStocksAction } from "@/features/decisions/actions";

export const dynamic = "force-dynamic";

export default async function CapturePage() {
  const stocks = await listStocksAction();
  return (
    <main className="page-shell space-y-4">
      <Link
        href="/"
        aria-label="記録をやめて今日に戻る"
        className="-ml-2 flex size-11 items-center justify-center rounded-xl text-foreground"
      >
        <X aria-hidden size={22} />
      </Link>
      <InboxCaptureForm stocks={stocks} />
    </main>
  );
}
