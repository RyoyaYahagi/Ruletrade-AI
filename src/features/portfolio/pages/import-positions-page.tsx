"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PortfolioPositionImportItem } from "@/schemas/portfolio/portfolio-position-import-schema";

const ASSET_TYPES = [
  { value: "stock", label: "個別株" },
  { value: "etf", label: "ETF" },
  { value: "fund", label: "投資信託" },
  { value: "reit", label: "REIT" },
  { value: "cash_like", label: "現金類似" },
  { value: "other", label: "その他" },
] as const;

const MARKETS = [
  { value: "JP", label: "日本" },
  { value: "US", label: "米国" },
  { value: "OTHER", label: "その他" },
] as const;

const assetTypeLabel = new Map(ASSET_TYPES.map((item) => [item.value, item.label]));

type ImportRow = PortfolioPositionImportItem & { rowId: string };

export function ImportPositionsPage() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [notes, setNotes] = useState<string | undefined>();
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function updateRow(rowId: string, patch: Partial<ImportRow>) {
    setRows((current) =>
      current.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)),
    );
  }

  function removeRow(rowId: string) {
    setRows((current) => current.filter((row) => row.rowId !== rowId));
  }

  async function handleExtract() {
    if (files.length === 0) {
      setErrorMessage("画像を1枚以上選択してください。");
      return;
    }

    setIsExtracting(true);
    setErrorMessage(null);
    setRows([]);
    setNotes(undefined);

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    try {
      const response = await fetch("/api/portfolio/positions/import", {
        method: "POST",
        body: formData,
      });
      const json = await response.json();

      if (!response.ok || !json.ok) {
        setErrorMessage(json.error?.message ?? "画像の解析に失敗しました。");
        return;
      }

      setRows(
        (json.data.positions as PortfolioPositionImportItem[]).map((row, index) => ({
          ...row,
          rowId: `${Date.now()}-${index}`,
        })),
      );
      setNotes(json.data.notes);
    } catch {
      setErrorMessage("通信に失敗しました。");
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleSubmit() {
    const invalidRows = rows.filter(
      (row) =>
        (!row.ticker?.trim() && !row.companyName?.trim()) ||
        row.marketValue == null,
    );
    if (rows.length === 0) {
      setErrorMessage("登録する抽出結果がありません。");
      return;
    }
    if (invalidRows.length > 0) {
      setErrorMessage("銘柄名または評価額が未入力の行を確認してください。");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/portfolio/positions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          positions: rows.map((row) => {
            const position: Partial<ImportRow> = { ...row };
            delete position.rowId;
            delete position.confidence;
            delete position.extractionNote;
            return { ...position, positionStatus: "active" };
          }),
        }),
      });
      const json = await response.json();

      if (!response.ok || !json.ok) {
        setErrorMessage(json.error?.message ?? "保有銘柄の一括追加に失敗しました。");
        return;
      }

      router.push("/portfolio");
    } catch {
      setErrorMessage("通信に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl p-6" data-testid="portfolio-position-import-page">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">画像から保有銘柄を追加</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            口座画面のスクリーンショットを複数選択し、個別株と投資信託をまとめて取り込みます。
          </p>
        </div>
        <a href="/portfolio" className="rounded-md border px-4 py-2 text-sm">
          ポートフォリオへ戻る
        </a>
      </div>

      {errorMessage ? (
        <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <section className="mt-6 rounded-lg border p-6">
        <h2 className="text-lg font-semibold">画像を選択</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          PNG、JPEG、WebP。1枚10MB、合計30MB、最大10枚まで。
        </p>
        <input
          className="mt-4 block w-full rounded-md border p-3 text-sm"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
          data-testid="portfolio-position-import-files"
        />
        {files.length > 0 ? (
          <p className="mt-2 text-sm">{files.length}枚選択中</p>
        ) : null}
        <button
          type="button"
          onClick={() => void handleExtract()}
          disabled={isExtracting || files.length === 0}
          className="mt-4 rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          data-testid="portfolio-position-import-extract"
        >
          {isExtracting ? "解析中..." : "画像を解析"}
        </button>
      </section>

      {notes ? (
        <p className="mt-4 rounded-md bg-yellow-50 p-3 text-sm text-yellow-900">
          {notes}
        </p>
      ) : null}

      <section className="mt-6 rounded-lg border p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">抽出結果を確認</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              解析結果は自動登録されません。内容を確認・修正してから一括追加してください。
            </p>
          </div>
          <span className="text-sm text-muted-foreground">{rows.length}件</span>
        </div>

        {rows.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            まだ抽出結果がありません。
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {rows.map((row) => (
              <div key={row.rowId} className="rounded-md border p-4">
                <div className="grid gap-3 md:grid-cols-6">
                  <label className="md:col-span-2">
                    <span className="text-xs font-medium">銘柄名</span>
                    <input
                      value={row.companyName ?? ""}
                      onChange={(event) => updateRow(row.rowId, { companyName: event.target.value || undefined })}
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </label>
                  <label>
                    <span className="text-xs font-medium">コード</span>
                    <input
                      value={row.ticker ?? ""}
                      onChange={(event) => updateRow(row.rowId, { ticker: event.target.value || undefined })}
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </label>
                  <label>
                    <span className="text-xs font-medium">種類</span>
                    <select
                      value={row.assetType}
                      onChange={(event) => updateRow(row.rowId, { assetType: event.target.value as ImportRow["assetType"] })}
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    >
                      {ASSET_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="text-xs font-medium">市場</span>
                    <select
                      value={row.market}
                      onChange={(event) => updateRow(row.rowId, { market: event.target.value as ImportRow["market"] })}
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    >
                      {MARKETS.map((market) => (
                        <option key={market.value} value={market.value}>
                          {market.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="text-xs font-medium">評価額 *</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={row.marketValue ?? ""}
                      onChange={(event) => updateRow(row.rowId, { marketValue: event.target.value === "" ? undefined : Number(event.target.value) })}
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </label>
                </div>
                <div className="mt-3 flex items-center justify-between gap-4 text-xs">
                  <span className={row.confidence === "low" ? "text-red-700" : "text-muted-foreground"}>
                    抽出信頼度: {row.confidence === "high" ? "高" : row.confidence === "low" ? "低" : "中"}
                    {row.extractionNote ? ` / ${row.extractionNote}` : ""}
                  </span>
                  <button type="button" onClick={() => removeRow(row.rowId)} className="text-red-700">
                    この行を除外
                  </button>
                </div>
                {row.assetType === "fund" && !row.ticker ? (
                  <p className="mt-2 text-xs text-blue-700">
                    投資信託はコードがなくてもファンド名で登録できます。
                  </p>
                ) : null}
                <span className="sr-only">{assetTypeLabel.get(row.assetType)}</span>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={isSubmitting || rows.length === 0}
          className="mt-6 rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          data-testid="portfolio-position-import-submit"
        >
          {isSubmitting ? "追加中..." : `${rows.length}件を一括追加`}
        </button>
      </section>
    </main>
  );
}
