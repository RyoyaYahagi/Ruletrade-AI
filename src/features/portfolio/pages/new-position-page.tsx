"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const ASSET_TYPES = [
  { value: "stock", label: "株式" },
  { value: "etf", label: "ETF" },
  { value: "fund", label: "投資信託" },
  { value: "reit", label: "REIT" },
  { value: "cash_like", label: "現金類似" },
  { value: "other", label: "その他" },
];

const MARKETS = [
  { value: "JP", label: "日本" },
  { value: "US", label: "米国" },
  { value: "OTHER", label: "その他" },
];

const CURRENCIES = [
  { value: "JPY", label: "JPY" },
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "GBP", label: "GBP" },
  { value: "OTHER", label: "その他" },
];

export function NewPositionPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const controller = new AbortController();

    const formData = new FormData(event.currentTarget);
    const payload = {
      ticker: String(formData.get("ticker")),
      companyName: String(formData.get("companyName") || ""),
      market: String(formData.get("market")),
      currency: String(formData.get("currency")),
      assetType: String(formData.get("assetType")),
      sector: String(formData.get("sector") || ""),
      theme: String(formData.get("theme") || ""),
      quantity: formData.get("quantity")
        ? Number(formData.get("quantity"))
        : undefined,
      averageCost: formData.get("averageCost")
        ? Number(formData.get("averageCost"))
        : undefined,
      currentPrice: formData.get("currentPrice")
        ? Number(formData.get("currentPrice"))
        : undefined,
      marketValue: Number(formData.get("marketValue")),
      targetWeightPercent: formData.get("targetWeightPercent")
        ? Number(formData.get("targetWeightPercent"))
        : undefined,
      memo: String(formData.get("memo") || ""),
    };

    try {
      const response = await fetch("/api/portfolio/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const json = await response.json();

      if (!response.ok || !json.ok) {
        setErrorMessage(
          json.error?.message ?? "保有銘柄の追加に失敗しました。",
        );
        return;
      }

      router.push("/portfolio");
    } catch {
      setErrorMessage("通信に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }

    return () => controller.abort();
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold">保有銘柄を追加</h1>

      {errorMessage ? (
        <p
          className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="ticker" className="block text-sm font-medium">
            銘柄コード *
          </label>
          <input
            id="ticker"
            name="ticker"
            required
            maxLength={32}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="companyName" className="block text-sm font-medium">
            会社名
          </label>
          <input
            id="companyName"
            name="companyName"
            maxLength={200}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="market" className="block text-sm font-medium">
              市場 *
            </label>
            <select
              id="market"
              name="market"
              required
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            >
              {MARKETS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="currency" className="block text-sm font-medium">
              通貨 *
            </label>
            <select
              id="currency"
              name="currency"
              required
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            >
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="assetType" className="block text-sm font-medium">
              資産タイプ *
            </label>
            <select
              id="assetType"
              name="assetType"
              required
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            >
              {ASSET_TYPES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="sector" className="block text-sm font-medium">
              セクター
            </label>
            <input
              id="sector"
              name="sector"
              maxLength={100}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="theme" className="block text-sm font-medium">
              テーマ
            </label>
            <input
              id="theme"
              name="theme"
              maxLength={100}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="quantity" className="block text-sm font-medium">
              数量
            </label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              min={0}
              step="0.000001"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="averageCost" className="block text-sm font-medium">
              平均取得単価
            </label>
            <input
              id="averageCost"
              name="averageCost"
              type="number"
              min={0}
              step="0.0001"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="currentPrice" className="block text-sm font-medium">
              現在価格
            </label>
            <input
              id="currentPrice"
              name="currentPrice"
              type="number"
              min={0}
              step="0.0001"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="marketValue" className="block text-sm font-medium">
              評価額 *
            </label>
            <input
              id="marketValue"
              name="marketValue"
              type="number"
              required
              min={0}
              step="0.01"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="targetWeightPercent"
              className="block text-sm font-medium"
            >
              目標比率 (%)
            </label>
            <input
              id="targetWeightPercent"
              name="targetWeightPercent"
              type="number"
              min={0}
              max={100}
              step="0.01"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label htmlFor="memo" className="block text-sm font-medium">
            メモ
          </label>
          <textarea
            id="memo"
            name="memo"
            maxLength={4000}
            rows={3}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {isSubmitting ? "追加中..." : "追加"}
          </button>

          <Link
            href="/portfolio"
            className="rounded-md border px-4 py-2 text-sm"
          >
            キャンセル
          </Link>
        </div>
      </form>
    </main>
  );
}
