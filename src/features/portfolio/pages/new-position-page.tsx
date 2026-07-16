"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

type PositionCheckResult = {
  ruleConfigured: boolean;
  tickerPercentAfter: number;
  sectorPercentAfter: number | null;
  themePercentAfter: number | null;
  insufficientCash: boolean;
  newViolations: Array<{
    ruleKey: string;
    subject: string;
    message: string;
  }>;
};

export function NewPositionPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [assetType, setAssetType] = useState("stock");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<PositionCheckResult | null>(
    null,
  );

  async function handlePreCheck(form: HTMLFormElement) {
    setIsChecking(true);
    setErrorMessage(null);
    setCheckResult(null);

    const formData = new FormData(form);
    const ticker = String(formData.get("ticker") || "");
    const companyName = String(formData.get("companyName") || "");
    const identifier = (ticker || companyName).slice(0, 32);
    const payload = {
      ticker: identifier,
      marketValue: Number(formData.get("marketValue") || 0),
      sector: String(formData.get("sector") || "") || undefined,
      theme: String(formData.get("theme") || "") || undefined,
      assetType: String(formData.get("assetType") || "") || undefined,
      market: String(formData.get("market") || "") || undefined,
    };

    if (!identifier) {
      setErrorMessage("事前チェックには銘柄コードと評価額が必要です。");
      setIsChecking(false);
      return;
    }

    try {
      const response = await fetch("/api/portfolio/positions/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();

      if (!response.ok || !json.ok) {
        setErrorMessage(json.error?.message ?? "事前チェックに失敗しました。");
        return;
      }

      setCheckResult(json.data);
    } catch {
      setErrorMessage("通信に失敗しました。");
    } finally {
      setIsChecking(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      ticker: String(formData.get("ticker") || "") || undefined,
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
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold">保有銘柄を追加</h1>

      {errorMessage ? (
        <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium">
            {assetType === "fund" ? "ファンドコード（任意）" : "銘柄コード *"}
          </label>
          <input
            name="ticker"
            required={assetType !== "fund"}
            maxLength={32}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">
            {assetType === "fund" ? "ファンド名 *" : "会社名"}
          </label>
          <input
            name="companyName"
            required={assetType === "fund"}
            maxLength={200}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium">市場 *</label>
            <select
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
            <label className="block text-sm font-medium">通貨 *</label>
            <select
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
            <label className="block text-sm font-medium">資産タイプ *</label>
            <select
              name="assetType"
              required
              value={assetType}
              onChange={(event) => setAssetType(event.target.value)}
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">セクター</label>
            <input
              name="sector"
              maxLength={100}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">テーマ</label>
            <input
              name="theme"
              maxLength={100}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium">数量</label>
            <input
              name="quantity"
              type="number"
              min={0}
              step="0.000001"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">平均取得単価</label>
            <input
              name="averageCost"
              type="number"
              min={0}
              step="0.0001"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">現在価格</label>
            <input
              name="currentPrice"
              type="number"
              min={0}
              step="0.0001"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">評価額 *</label>
            <input
              name="marketValue"
              type="number"
              required
              min={0}
              step="0.01"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">目標比率 (%)</label>
            <input
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
          <label className="block text-sm font-medium">メモ</label>
          <textarea
            name="memo"
            maxLength={4000}
            rows={3}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        {checkResult ? (
          <div
            className={`rounded-md p-3 text-sm ${
              checkResult.newViolations.length > 0
                ? "bg-red-50 text-red-700"
                : "bg-green-50 text-green-700"
            }`}
            data-testid="position-check-result"
          >
            <p className="font-medium">
              {checkResult.newViolations.length > 0
                ? `この追加で共通ルール違反が${checkResult.newViolations.length}件発生します。`
                : checkResult.ruleConfigured
                  ? "この追加による共通ルール違反はありません。"
                  : "共通ルールが未設定のため、比率のみ表示します。"}
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>追加後のこの銘柄の比率: {checkResult.tickerPercentAfter}%</li>
              {checkResult.sectorPercentAfter !== null ? (
                <li>
                  追加後のこのセクターの比率: {checkResult.sectorPercentAfter}%
                </li>
              ) : null}
              {checkResult.themePercentAfter !== null ? (
                <li>
                  追加後のこのテーマの比率: {checkResult.themePercentAfter}%
                </li>
              ) : null}
              {checkResult.newViolations.map((violation) => (
                <li key={`${violation.ruleKey}-${violation.subject}`}>
                  {violation.message}
                </li>
              ))}
            </ul>
            {checkResult.insufficientCash ? (
              <p className="mt-1">
                登録済みの現金より評価額が大きいため、現金比率は0%として計算しています。
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex gap-4">
          <button
            type="button"
            disabled={isChecking}
            onClick={(event) =>
              handlePreCheck(event.currentTarget.form as HTMLFormElement)
            }
            className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
            data-testid="position-pre-check"
          >
            {isChecking ? "チェック中..." : "共通ルールと照合"}
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {isSubmitting ? "追加中..." : "追加"}
          </button>

          <a href="/portfolio" className="rounded-md border px-4 py-2 text-sm">
            キャンセル
          </a>
        </div>
      </form>
    </main>
  );
}
