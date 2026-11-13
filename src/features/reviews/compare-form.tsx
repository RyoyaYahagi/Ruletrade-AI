"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  saveDecisionAction,
  saveReviewAction,
} from "@/features/decisions/actions";
import type { Decision } from "@/schemas/decision";
import type { Stock } from "@/schemas/stock";

function localDateInputValue() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

export function CompareForm({
  stock,
  reviewDecision,
}: {
  stock: Stock;
  reviewDecision: Decision | null;
}) {
  const router = useRouter();
  const [currentInput, setCurrentInput] = useState("");
  const [reflection, setReflection] = useState("");
  const [recordSale, setRecordSale] = useState(false);
  const [saleQuantity, setSaleQuantity] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [saleDate, setSaleDate] = useState(localDateInputValue());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!currentInput.trim() || !reflection.trim()) return;
    if (recordSale && (!saleQuantity || Number(saleQuantity) <= 0)) {
      setError("売却数量を入力してください。");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let decisionId = reviewDecision?.id ?? null;
      if (recordSale) {
        const saleDecision = await saveDecisionAction({
          stockId: stock.id,
          type: "sell",
          stock,
          rawInput: currentInput.trim(),
          transcript: null,
          followUpAnswer: null,
          summary: currentInput.trim(),
          points: [],
          followUpQuestion: null,
          transaction: null,
          transactionInput: {
            side: "sell",
            quantity: Number(saleQuantity),
            price: salePrice ? Number(salePrice) : null,
            fee: null,
            executedAt: new Date(`${saleDate}T12:00:00.000Z`).toISOString(),
          },
        });
        decisionId = saleDecision.decisionId;
      }
      await saveReviewAction({
        stockId: stock.id,
        decisionId,
        currentInput: currentInput.trim(),
        summary: currentInput.trim(),
        differences: [],
        reflection: reflection.trim(),
      });
      router.push(`/stocks/${stock.id}?tab=reviews`);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "振り返りを保存できませんでした。",
      );
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2" aria-labelledby="now-heading">
        <h2 id="now-heading" className="section-label">
          いまのあなた
        </h2>
        <div className="surface p-5">
          <label htmlFor="current-thought" className="sr-only">
            現在の考え
          </label>
          <textarea
            id="current-thought"
            value={currentInput}
            onChange={(event) => setCurrentInput(event.target.value)}
            disabled={saving}
            rows={5}
            placeholder="いまはどう考えていますか？過去の記録を読み返し、変化や気づきを書きます。"
            className="journal-text w-full resize-y bg-transparent text-[17px] outline-none placeholder:text-muted-foreground/70"
          />
        </div>
      </section>
      <section className="space-y-2">
        <label htmlFor="reflection" className="section-label block">
          自分の振り返り
        </label>
        <div className="surface p-5">
          <textarea
            id="reflection"
            value={reflection}
            onChange={(event) => setReflection(event.target.value)}
            disabled={saving}
            rows={4}
            placeholder="当時の判断と今の考えを読み比べて、気づいたことを記録します。"
            className="journal-text w-full resize-y bg-transparent outline-none placeholder:text-muted-foreground/70"
          />
        </div>
      </section>
      <section className="surface space-y-3 p-5">
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={recordSale}
            onChange={(event) => setRecordSale(event.target.checked)}
            disabled={saving}
            className="size-5 accent-primary"
          />
          売却判断と取引も記録する
        </label>
        {recordSale && (
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm text-muted-foreground">
              売却数量
              <input
                type="number"
                min="0.0001"
                step="any"
                value={saleQuantity}
                onChange={(event) => setSaleQuantity(event.target.value)}
                className="input mt-1 text-foreground"
              />
            </label>
            <label className="text-sm text-muted-foreground">
              単価（任意）
              <input
                type="number"
                min="0"
                step="any"
                value={salePrice}
                onChange={(event) => setSalePrice(event.target.value)}
                className="input mt-1 text-foreground"
              />
            </label>
            <label className="text-sm text-muted-foreground">
              約定日
              <input
                type="date"
                value={saleDate}
                onChange={(event) => setSaleDate(event.target.value)}
                className="input mt-1 text-foreground"
              />
            </label>
          </div>
        )}
      </section>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <div className="action-bar">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !currentInput.trim() || !reflection.trim()}
          className="button-primary min-h-14 w-full"
        >
          {saving ? "保存しています…" : "振り返りを保存"}
        </button>
      </div>
    </div>
  );
}
