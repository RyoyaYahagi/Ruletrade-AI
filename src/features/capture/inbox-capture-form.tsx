"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Inbox, Sparkles } from "lucide-react";

import { saveCaptureAction } from "@/features/capture/inbox-actions";
import type { Stock } from "@/schemas/stock";

type SavedCapture = {
  captureId: string;
  createdAt: string;
  rawInput: string;
  stockLabel: string;
};

export function InboxCaptureForm({
  stocks,
  fixedStock,
}: {
  stocks: Stock[];
  fixedStock?: Stock;
}) {
  const [rawInput, setRawInput] = useState("");
  const [stockId, setStockId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedCapture | null>(null);

  const selectedStock =
    fixedStock ?? stocks.find((stock) => stock.id === stockId) ?? null;
  const structuredHref = fixedStock
    ? `/capture/structured?stockId=${fixedStock.id}`
    : "/capture/structured";

  async function save() {
    if (!rawInput.trim()) {
      setError("記録する内容を入力してください。");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await saveCaptureAction({
        rawInput,
        stockId: selectedStock?.id ?? null,
        stockHint: null,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSaved({
        captureId: result.captureId,
        createdAt: result.createdAt,
        rawInput,
        stockLabel: selectedStock?.name ?? "未定",
      });
      setRawInput("");
      if (!fixedStock) setStockId("");
      // モバイルで保存ボタンが画面下にあっても、保存結果が見える位置へ戻す。
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError(
        "保存できませんでした。入力内容を確認してもう一度お試しください。",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="capture-heading" className="space-y-5">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
            <Inbox aria-hidden size={16} />
            受け箱
          </p>
          <h1 id="capture-heading" className="page-title mt-1">
            考えをそのまま残す
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            AIは使いません。書いた原文をそのまま保存し、あとで整理できます。
          </p>
        </div>

        {saved && (
          <section
            role="status"
            aria-live="polite"
            className="surface space-y-3 border border-primary/20 p-5"
          >
            <p className="flex items-center gap-2 font-semibold text-primary">
              <Check aria-hidden size={18} />
              受け箱に保存しました
            </p>
            <p className="text-sm text-muted-foreground">
              未整理として保存しました。銘柄: {saved.stockLabel}
            </p>
            <div className="rounded-xl bg-secondary p-3">
              <p className="text-xs font-semibold text-muted-foreground">
                保存した原文
              </p>
              <p className="journal-text mt-1 whitespace-pre-wrap text-[15px]">
                {saved.rawInput}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              振り返り日は保存していません。整理するときに決められます。
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/" className="button-outline">
                今日へ戻る
              </Link>
              <button
                type="button"
                onClick={() => setSaved(null)}
                className="button-soft"
              >
                続けて記録する
              </button>
            </div>
          </section>
        )}

        <div className="surface space-y-4 p-5">
          {fixedStock ? (
            <p className="text-sm">
              <span className="text-muted-foreground">記録する銘柄</span>
              <span className="ml-2 rounded-full bg-accent px-3 py-1 font-semibold text-accent-foreground">
                {fixedStock.name}
              </span>
            </p>
          ) : (
            <label
              htmlFor="capture-stock"
              className="block text-sm text-muted-foreground"
            >
              銘柄（任意）
              <select
                id="capture-stock"
                value={stockId}
                disabled={saving}
                onChange={(event) => setStockId(event.target.value)}
                className="input mt-1 text-foreground"
              >
                <option value="">銘柄を選ばない（未定）</option>
                {stocks.map((stock) => (
                  <option key={stock.id} value={stock.id}>
                    {stock.name}
                    {stock.ticker ? ` (${stock.ticker})` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div>
            <label
              htmlFor="raw-input"
              className="text-sm text-muted-foreground"
            >
              いま考えていること
            </label>
            <textarea
              id="raw-input"
              value={rawInput}
              onChange={(event) => setRawInput(event.target.value)}
              disabled={saving}
              rows={8}
              placeholder="思ったことを、そのまま。銘柄が決まっていなくても保存できます。"
              className="journal-text mt-2 w-full resize-y bg-transparent text-lg outline-none placeholder:text-muted-foreground/70"
            />
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <div className="action-bar space-y-2">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="button-primary min-h-14 w-full"
          >
            <Inbox aria-hidden size={18} />
            {saving ? "保存しています…" : "受け箱に保存"}
          </button>
          <p className="text-center text-xs text-muted-foreground">
            保存時に振り返り日は付けません
          </p>
        </div>
      </section>

      <section className="surface space-y-2 p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <Sparkles aria-hidden size={16} className="text-ai" />
          AIで整理して記録する
        </p>
        <p className="text-muted-foreground">
          内容を整理してから保存したいときは、こちらのフォームを使えます。
        </p>
        <Link
          href={structuredHref}
          className="inline-flex min-h-11 items-center font-medium text-primary"
        >
          整理フォームを開く
        </Link>
      </section>
    </div>
  );
}
