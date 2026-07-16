"use client";

import { useEffect, useMemo, useState } from "react";

type UsageSummary = {
  usedCostUsd: number;
  limitCostUsd: number;
  remainingCostUsd: number;
  byFeature: Array<{ taskType: string; callCount: number; costUsd: number }>;
};

export function AiUsagePanel() {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [limit, setLimit] = useState("1");
  const [maxLimit, setMaxLimit] = useState(10);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [summaryResponse, settingsResponse] = await Promise.all([
        fetch("/api/ai-usage/summary"),
        fetch("/api/ai-usage/settings"),
      ]);
      const summaryJson = await summaryResponse.json();
      const settingsJson = await settingsResponse.json();
      if (summaryJson.ok) setSummary(summaryJson.data);
      if (settingsJson.ok) {
        setLimit(String(settingsJson.data.monthlyLimitUsd));
        setMaxLimit(settingsJson.data.maxMonthlyLimitUsd);
      }
    }

    void load();
  }, []);

  const progress = useMemo(() => {
    if (!summary || summary.limitCostUsd <= 0) return 0;
    return Math.min(100, (summary.usedCostUsd / summary.limitCostUsd) * 100);
  }, [summary]);

  async function saveLimit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const response = await fetch("/api/ai-usage/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ monthlyLimitUsd: Number(limit) }),
    });
    const json = await response.json();
    if (!response.ok || !json.ok) {
      setMessage(json.error?.message ?? "上限の保存に失敗しました。");
      return;
    }
    setMessage("上限を保存しました。");
    setSummary((current) =>
      current
        ? { ...current, limitCostUsd: json.data.monthlyLimitUsd }
        : current,
    );
  }

  if (!summary) {
    return (
      <p className="text-sm text-muted-foreground">利用状況を読み込み中...</p>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">今月の利用額</h2>
          <p className="font-medium">
            ${summary.usedCostUsd.toFixed(2)} / $
            {summary.limitCostUsd.toFixed(2)}
          </p>
        </div>
        <div
          className="mt-3 h-3 overflow-hidden rounded-full bg-muted"
          aria-label="AI利用額の進捗"
        >
          <div
            className={`h-full ${progress >= 80 ? "bg-amber-500" : "bg-blue-600"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          残り ${summary.remainingCostUsd.toFixed(2)}
        </p>
      </section>

      <section className="rounded-lg border p-5">
        <h2 className="text-lg font-semibold">機能別の内訳</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">機能</th>
              <th className="py-2 text-right">回数</th>
              <th className="py-2 text-right">金額</th>
            </tr>
          </thead>
          <tbody>
            {summary.byFeature.map((feature) => (
              <tr key={feature.taskType} className="border-b">
                <td className="py-2">{feature.taskType}</td>
                <td className="py-2 text-right">{feature.callCount}</td>
                <td className="py-2 text-right">
                  ${feature.costUsd.toFixed(4)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border p-5">
        <h2 className="text-lg font-semibold">月間上限</h2>
        <form
          className="mt-3 flex flex-wrap items-end gap-3"
          onSubmit={saveLimit}
        >
          <label className="text-sm">
            上限（USD）
            <input
              className="mt-1 block w-32 rounded-md border px-3 py-2"
              type="number"
              min={0.1}
              max={maxLimit}
              step={0.1}
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
            />
          </label>
          <button
            className="rounded-md bg-black px-4 py-2 text-sm text-white"
            type="submit"
          >
            保存
          </button>
        </form>
        {message ? <p className="mt-2 text-sm">{message}</p> : null}
        <p className="mt-4 text-sm text-muted-foreground">
          上限に達すると AI
          機能（下書き生成・レビュー・ニュース要約）は翌月まで停止します。
          価格の自動取得やルール条件の通知は AI を使わないため、停止しません。
        </p>
      </section>
    </div>
  );
}
