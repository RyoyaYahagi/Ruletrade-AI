"use client";

import { useState } from "react";

export function DataExportPanel() {
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch("/api/privacy/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exportFormat: "json",
          includeAiLogs: true,
          includeDocumentsMetadata: true,
          includeExtractedText: false,
          includeRagChunks: false,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error?.message ?? "エクスポートに失敗しました。");
        return;
      }
      setResult(json.data.export);
    } catch {
      setError("通信に失敗しました。");
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="rounded-lg border p-6">
      <h2 className="text-lg font-semibold">データエクスポート</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        保存されている自分のデータをJSON形式で確認できます。
      </p>
      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      {result ? (
        <div className="mt-4 max-h-96 overflow-auto rounded-md border bg-gray-50 p-3">
          <pre className="text-xs">{JSON.stringify(result, null, 2)}</pre>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={exporting}
        className="mt-4 rounded-md border px-4 py-2 text-sm disabled:opacity-50"
      >
        {exporting ? "処理中..." : "データをエクスポートする"}
      </button>
    </section>
  );
}
