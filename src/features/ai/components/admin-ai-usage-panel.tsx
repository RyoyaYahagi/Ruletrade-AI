"use client";

import { useEffect, useState } from "react";

type Pricing = {
  id: string;
  provider: string;
  model: string;
  input_cost_per_1m_tokens_usd: number;
  output_cost_per_1m_tokens_usd: number;
  effective_from: string;
  is_active: boolean;
};

export function AdminAiUsagePanel() {
  const [usage, setUsage] = useState<{
    totalCostUsd: number;
    topUsers: Array<{ userId: string; costUsd: number }>;
    byFeature: Array<{ taskType: string; costUsd: number }>;
  } | null>(null);
  const [pricing, setPricing] = useState<Pricing[]>([]);
  const [form, setForm] = useState({
    provider: "openai",
    model: "gpt-4.1-mini",
    inputCostPer1mTokensUsd: "",
    outputCostPer1mTokensUsd: "",
    effectiveFrom: new Date().toISOString(),
  });
  const [message, setMessage] = useState<string | null>(null);

  async function fetchData() {
    const [usageResponse, pricingResponse] = await Promise.all([
      fetch("/api/admin/ai-usage"),
      fetch("/api/admin/model-pricing"),
    ]);
    const usageJson = await usageResponse.json();
    const pricingJson = await pricingResponse.json();
    return {
      usage: usageJson.ok ? usageJson.data : null,
      pricing: pricingJson.ok ? pricingJson.data.pricing : [],
    };
  }

  async function load() {
    const data = await fetchData();
    setUsage(data.usage);
    setPricing(data.pricing);
  }

  useEffect(() => {
    let active = true;
    void fetchData().then((data) => {
      if (!active) return;
      setUsage(data.usage);
      setPricing(data.pricing);
    });

    return () => {
      active = false;
    };
  }, []);

  async function addPricing(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/admin/model-pricing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...form,
        inputCostPer1mTokensUsd: Number(form.inputCostPer1mTokensUsd),
        outputCostPer1mTokensUsd: Number(form.outputCostPer1mTokensUsd),
      }),
    });
    const json = await response.json();
    setMessage(
      response.ok && json.ok
        ? "単価を追加しました。"
        : (json.error?.message ?? "単価の追加に失敗しました。"),
    );
    if (response.ok && json.ok) await load();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border p-5">
        <h2 className="text-lg font-semibold">今月の全体利用額</h2>
        <p className="mt-2 text-2xl font-bold">
          ${usage?.totalCostUsd.toFixed(2) ?? "-"}
        </p>
        <h3 className="mt-4 font-medium">ユーザー別上位20件</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {usage?.topUsers.map((user) => (
            <li key={user.userId} className="flex justify-between gap-3">
              <span className="font-mono">{user.userId}</span>
              <span>${user.costUsd.toFixed(4)}</span>
            </li>
          ))}
        </ul>
        <h3 className="mt-4 font-medium">機能別</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {usage?.byFeature.map((feature) => (
            <li key={feature.taskType} className="flex justify-between gap-3">
              <span>{feature.taskType}</span>
              <span>${feature.costUsd.toFixed(4)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border p-5">
        <h2 className="text-lg font-semibold">モデル単価表</h2>
        <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={addPricing}>
          {(
            [
              ["provider", "Provider"],
              ["model", "Model"],
              ["inputCostPer1mTokensUsd", "Input USD / 1M tokens"],
              ["outputCostPer1mTokensUsd", "Output USD / 1M tokens"],
              ["effectiveFrom", "Effective from"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="text-sm">
              {label}
              <input
                className="mt-1 block w-full rounded-md border px-3 py-2"
                type={key.includes("Cost") ? "number" : "text"}
                step={key.includes("Cost") ? "0.000001" : undefined}
                value={form[key]}
                onChange={(event) =>
                  setForm({ ...form, [key]: event.target.value })
                }
              />
            </label>
          ))}
          <button
            className="rounded-md bg-black px-4 py-2 text-sm text-white"
            type="submit"
          >
            単価を追加
          </button>
        </form>
        {message ? <p className="mt-2 text-sm">{message}</p> : null}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">Provider / Model</th>
                <th className="py-2 text-right">Input</th>
                <th className="py-2 text-right">Output</th>
                <th className="py-2">Active</th>
              </tr>
            </thead>
            <tbody>
              {pricing.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-2">
                    {item.provider} / {item.model}
                  </td>
                  <td className="py-2 text-right">
                    {item.input_cost_per_1m_tokens_usd}
                  </td>
                  <td className="py-2 text-right">
                    {item.output_cost_per_1m_tokens_usd}
                  </td>
                  <td className="py-2">{item.is_active ? "yes" : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
