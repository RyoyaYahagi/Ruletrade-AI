import { ChevronRight } from "lucide-react";
import { JsonImportPanel } from "@/features/json-import/import-panel";
import { ImportPanel } from "@/features/csv-import/import-panel";
import { listImportBatches } from "@/features/csv-import/service";
import { FeedbackButton } from "./feedback-button";

export const dynamic = "force-dynamic";

export default function MorePage() {
  return (
    <main className="page-shell space-y-8">
      <h1 className="page-title">その他</h1>
      <ImportPanel batches={listImportBatches()} />
      <section className="space-y-2" aria-labelledby="backup-heading">
        <h2 id="backup-heading" className="section-label">
          バックアップ
        </h2>
        <div className="surface divide-y">
          <a
            href="/api/export"
            download
            className="flex min-h-15 items-center justify-between gap-3 px-5 py-3"
          >
            <span>
              <span className="block font-medium">JSONをエクスポート</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                判断記録や売買履歴をまとめて保存します
              </span>
            </span>
            <ChevronRight aria-hidden size={18} className="text-muted-foreground" />
          </a>
          <div className="px-5 py-4">
            <JsonImportPanel />
          </div>
        </div>
      </section>
      <section className="space-y-2" aria-labelledby="support-heading">
        <h2 id="support-heading" className="section-label">
          サポート
        </h2>
        <FeedbackButton />
      </section>
      <p className="px-1 text-xs leading-6 text-muted-foreground">
        Ruletrade は自分の投資判断を記録して振り返るためのジャーナルです。投資助言・売買の推奨・注文の執行は行いません。
      </p>
    </main>
  );
}
