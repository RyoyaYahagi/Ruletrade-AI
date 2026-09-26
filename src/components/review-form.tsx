"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import type { ReviewComparison } from "@/lib/domain";

export function ReviewForm({ stockId }: { stockId: string }) {
  const router = useRouter();
  const [currentText, setCurrentText] = useState("");
  const [comparison, setComparison] = useState<ReviewComparison | null>(null);
  const [status, setStatus] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus("過去の自分と比較中…");
    setComparison(null);

    const response = await fetch(`/api/stocks/${stockId}/reviews`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentText }),
    });

    const body = (await response.json()) as {
      error?: string;
      comparison?: ReviewComparison;
    };

    if (!response.ok || !body.comparison) {
      setStatus(body.error || "レビューに失敗しました。");
      return;
    }

    setComparison(body.comparison);
    setStatus("レビューを保存しました。");
    router.refresh();
  }

  return (
    <div className="stack">
      <form className="stack" onSubmit={submit}>
        <label>
          今どう思ってる？
          <textarea
            rows={5}
            value={currentText}
            onChange={(e) => setCurrentText(e.target.value)}
            placeholder="例：最近下がっていて不安。ただ、購入時に期待していた需要はまだ崩れていないと思う。"
            required
          />
        </label>
        <div className="action-row">
          <button className="button" type="submit">過去の判断と比較</button>
          <span className="muted small">{status}</span>
        </div>
      </form>

      {comparison && (
        <div className="review-result">
          <p>{comparison.summary}</p>
          {comparison.unchanged.length > 0 && (
            <div>
              <strong>変わっていない点</strong>
              <ul>{comparison.unchanged.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          )}
          {comparison.changed.length > 0 && (
            <div>
              <strong>変わった点</strong>
              <ul>{comparison.changed.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          )}
          {comparison.unclear.length > 0 && (
            <div>
              <strong>今のメモだけでは分からない点</strong>
              <ul>{comparison.unclear.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          )}
          {comparison.question && <p><strong>確認：</strong>{comparison.question}</p>}
        </div>
      )}
    </div>
  );
}
