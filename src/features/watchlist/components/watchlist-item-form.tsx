"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function WatchlistItemForm() {
  const router = useRouter();
  const [ticker, setTicker] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [market, setMarket] = useState("");
  const [currency, setCurrency] = useState("JPY");
  const [priority, setPriority] = useState("medium");
  const [interestReason, setInterestReason] = useState("");
  const [targetPriceMin, setTargetPriceMin] = useState("");
  const [targetPriceMax, setTargetPriceMax] = useState("");
  const [plannedTranches, setPlannedTranches] = useState("");
  const [targetMultiple, setTargetMultiple] = useState("");
  const [maxPositionPercent, setMaxPositionPercent] = useState("");
  const [stopLossNote, setStopLossNote] = useState("");
  const [takeProfitNote, setTakeProfitNote] = useState("");
  const [earningsNote, setEarningsNote] = useState("");
  const [researchNotes, setResearchNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/watchlist/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          companyName: companyName || undefined,
          market: market || undefined,
          currency,
          priority,
          interestReason: interestReason || undefined,
          targetPriceMin: targetPriceMin ? Number(targetPriceMin) : undefined,
          targetPriceMax: targetPriceMax ? Number(targetPriceMax) : undefined,
          plannedTranches: plannedTranches
            ? Number(plannedTranches)
            : undefined,
          targetMultiple: targetMultiple ? Number(targetMultiple) : undefined,
          maxPositionPercent: maxPositionPercent
            ? Number(maxPositionPercent)
            : undefined,
          stopLossNote: stopLossNote || undefined,
          takeProfitNote: takeProfitNote || undefined,
          earningsNote: earningsNote || undefined,
          researchNotes: researchNotes || undefined,
        }),
      });

      const json = await response.json();
      if (!response.ok || !json.ok) {
        setErrorMessage(
          json.error?.message ?? "Watchlist itemの追加に失敗しました。",
        );
        return;
      }

      router.push("/watchlist");
    } catch {
      setErrorMessage("通信に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border p-6">
      <div>
        <label className="text-sm font-medium">銘柄コード</label>
        <input
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          placeholder="例: 6758"
          className="mt-1 w-full rounded-md border px-3 py-2"
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium">銘柄名</label>
        <input
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="例: ソニーグループ"
          className="mt-1 w-full rounded-md border px-3 py-2"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="text-sm font-medium">市場</label>
          <input
            value={market}
            onChange={(e) => setMarket(e.target.value)}
            placeholder="例: TSE"
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </div>
        <div>
          <label className="text-sm font-medium">通貨</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2"
          >
            <option value="JPY">JPY</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="OTHER">OTHER</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">優先度</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2"
          >
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">気になっている理由</label>
        <textarea
          value={interestReason}
          onChange={(e) => setInterestReason(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-md border px-3 py-2"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="text-sm font-medium">買いたい価格 下限</label>
          <input
            type="number"
            value={targetPriceMin}
            onChange={(e) => setTargetPriceMin(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </div>
        <div>
          <label className="text-sm font-medium">買いたい価格 上限</label>
          <input
            type="number"
            value={targetPriceMax}
            onChange={(e) => setTargetPriceMax(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </div>
        <div>
          <label className="text-sm font-medium">分割回数</label>
          <input
            type="number"
            value={plannedTranches}
            onChange={(e) => setPlannedTranches(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">目標倍率</label>
          <input
            type="number"
            step="0.1"
            value={targetMultiple}
            onChange={(e) => setTargetMultiple(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </div>
        <div>
          <label className="text-sm font-medium">最大投資比率</label>
          <input
            type="number"
            value={maxPositionPercent}
            onChange={(e) => setMaxPositionPercent(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">損切り・見直し条件メモ</label>
        <textarea
          value={stopLossNote}
          onChange={(e) => setStopLossNote(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border px-3 py-2"
        />
      </div>
      <div>
        <label className="text-sm font-medium">利确・出口条件メモ</label>
        <textarea
          value={takeProfitNote}
          onChange={(e) => setTakeProfitNote(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border px-3 py-2"
        />
      </div>
      <div>
        <label className="text-sm font-medium">決算メモ</label>
        <textarea
          value={earningsNote}
          onChange={(e) => setEarningsNote(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border px-3 py-2"
        />
      </div>
      <div>
        <label className="text-sm font-medium">調査メモ</label>
        <textarea
          value={researchNotes}
          onChange={(e) => setResearchNotes(e.target.value)}
          rows={5}
          className="mt-1 w-full rounded-md border px-3 py-2"
        />
      </div>
      {errorMessage ? (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isSubmitting || ticker.trim().length === 0}
        className="w-full rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {isSubmitting ? "追加中..." : "Watchlistに追加"}
      </button>
    </form>
  );
}
