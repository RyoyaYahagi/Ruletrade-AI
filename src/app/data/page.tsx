import { ImportPanel } from "@/features/csv-import/import-panel";
import { listImportBatches } from "@/features/csv-import/service";

export const dynamic = "force-dynamic";

export default function DataPage() {
  return (
    <main className="page-shell">
      <h1 className="text-3xl font-semibold tracking-tight">データ管理</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        記録したデータの書き出しや読み込みを管理します。
      </p>
      <section className="mt-10 border-t pt-6" aria-labelledby="export-heading">
        <h2 id="export-heading" className="text-lg font-semibold">
          データを書き出す
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          判断記録や売買履歴をJSON形式で保存できます。
        </p>
        <a
          href="/api/export"
          download
          className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
        >
          JSONをエクスポート
        </a>
      </section>
      <ImportPanel batches={listImportBatches()} />
    </main>
  );
}
