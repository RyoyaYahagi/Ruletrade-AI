"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createTransactionAction } from "@/features/transactions/actions";
import { decisionDisplayText } from "@/features/decisions/decision-display";
import type { Decision } from "@/schemas/decision";

function localDateInputValue() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function TransactionForm({ stockId, decisions }: { stockId: string; decisions: Decision[] }) {
  const router = useRouter();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [fee, setFee] = useState("");
  const [executedAt, setExecutedAt] = useState(localDateInputValue());
  const [decisionId, setDecisionId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createTransactionAction({
        stockId,
        side,
        quantity: Number(quantity),
        price: price ? Number(price) : null,
        fee: fee ? Number(fee) : null,
        executedAt: new Date(`${executedAt}T12:00:00.000Z`).toISOString(),
        decisionId: decisionId || undefined,
      });
      setQuantity("");
      setPrice("");
      setFee("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "売買履歴を保存できませんでした。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="surface space-y-4 p-5">
      <h2 className="font-semibold">売買の事実を記録</h2>
      <p className="text-xs text-muted-foreground">証券会社のCSVがない取引を手入力できます。</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="text-sm text-muted-foreground">売買<select value={side} onChange={(event) => setSide(event.target.value as "buy" | "sell")} className="input mt-1 text-foreground"><option value="buy">購入</option><option value="sell">売却</option></select></label>
        <label className="text-sm text-muted-foreground">数量<input required type="number" min="0.0001" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="input mt-1 text-foreground" /></label>
        <label className="text-sm text-muted-foreground">単価（任意）<input type="number" min="0" step="any" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="未入力" className="input mt-1 text-foreground" /></label>
        <label className="text-sm text-muted-foreground">手数料（任意）<input type="number" min="0" step="any" value={fee} onChange={(event) => setFee(event.target.value)} className="input mt-1 text-foreground" /></label>
        <label className="text-sm text-muted-foreground">約定日<input required type="date" value={executedAt} onChange={(event) => setExecutedAt(event.target.value)} className="input mt-1 text-foreground" /></label>
        <label className="text-sm text-muted-foreground">判断メモ（任意）<select value={decisionId} onChange={(event) => setDecisionId(event.target.value)} className="input mt-1 text-foreground"><option value="">紐付けない</option>{decisions.map((decision) => <option key={decision.id} value={decision.id}>{new Date(decision.createdAt).toLocaleDateString("ja-JP")} · {decisionDisplayText(decision).slice(0, 35)}</option>)}</select></label>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <button type="submit" disabled={saving || !quantity} className="button-soft w-full sm:w-auto">{saving ? "保存しています…" : "売買履歴に追加"}</button>
    </form>
  );
}
