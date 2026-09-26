"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function TransactionForm({ stockId }: { stockId: string }) {
  const router = useRouter();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [tradedAt, setTradedAt] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [fees, setFees] = useState("0");
  const [reflection, setReflection] = useState("");
  const [status, setStatus] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus("保存中…");

    const response = await fetch("/api/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        stockId,
        side,
        tradedAt,
        quantity: Number(quantity),
        price: Number(price),
        fees: Number(fees || 0),
        reflection: reflection.trim() || null,
      }),
    });

    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      setStatus(body.error || "保存に失敗しました。");
      return;
    }

    setQuantity("");
    setPrice("");
    setFees("0");
    setReflection("");
    setStatus("保存しました。");
    router.refresh();
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="row">
        <label>
          売買
          <select value={side} onChange={(e) => setSide(e.target.value as "buy" | "sell")}>
            <option value="buy">買い</option>
            <option value="sell">売り</option>
          </select>
        </label>
        <label>
          日付
          <input type="date" value={tradedAt} onChange={(e) => setTradedAt(e.target.value)} required />
        </label>
      </div>

      <div className="row">
        <label>
          数量
          <input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
        </label>
        <label>
          価格
          <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required />
        </label>
        <label>
          手数料
          <input inputMode="decimal" value={fees} onChange={(e) => setFees(e.target.value)} />
        </label>
      </div>

      <label>
        {side === "sell" ? "30秒振り返り：なぜ売った？" : "メモ（任意）"}
        <textarea
          rows={3}
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          placeholder={
            side === "sell"
              ? "当初の見直し条件と一致した？ 値動きだけに反応した？"
              : "この売買について残しておきたいこと"
          }
        />
      </label>

      <div className="action-row">
        <button className="button secondary" type="submit">売買履歴を追加</button>
        <span className="muted small">{status}</span>
      </div>
    </form>
  );
}
