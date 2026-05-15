"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewRuleForm() {
  const router = useRouter();

  const [ticker, setTicker] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [market, setMarket] = useState("TSE");
  const [currency, setCurrency] = useState("JPY");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/rule-sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ticker,
          companyName: companyName || undefined,
          market: market || undefined,
          currency,
        }),
      });

      const json = await response.json();

      if (!response.ok || !json.ok) {
        setErrorMessage(
          json.error?.message ?? "ルール作成セッションの作成に失敗しました。",
        );
        return;
      }

      router.push(`/rules/${json.data.sessionId}`);
    } catch {
      setErrorMessage("通信に失敗しました。もう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border p-6">
      <div>
        <label className="text-sm font-medium">銀棄コード</label>
        <input
          value={ticker}
          onChange={(event) => setTicker(event.target.value)}
          placeholder="例: 6758"
          className="mt-1 w-full rounded-md border px-3 py-2"
          required
        />
      </div>

      <div>
        <label className="text-sm font-medium">銀棄名</label>
        <input
          value={companyName}
          onChange={(event) => setCompanyName(event.target.value)}
          placeholder="例: ソニーグループ"
          className="mt-1 w-full rounded-md border px-3 py-2"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">市場</label>
          <input
            value={market}
            onChange={(event) => setMarket(event.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2"
          />
        </div>

        <div>
          <label className="text-sm font-medium">通貨</label>
          <select
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2"
          >
            <option value="JPY">JPY</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="OTHER">OTHER</option>
          </select>
        </div>
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
        {isSubmitting ? "作成中..." : "ルール作成を始める"}
      </button>
    </form>
  );
}
