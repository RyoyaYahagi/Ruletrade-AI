"use client";

import { useEffect, useState } from "react";

export function PortfolioSummaryCard() {
  const [data, setData] = useState<{
    portfolio: {
      name: string;
      base_currency: string;
      cash_amount: number;
      notes: string | null;
    };
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/portfolio", {
          signal: controller.signal,
        });
        const json = await response.json();

        if (json.ok) {
          setData(json.data);
        } else {
          setError(json.error?.message ?? "データの取得に失敗しました");
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError("データの取得に失敗しました");
      } finally {
        setIsLoading(false);
      }
    }

    void load();

    return () => controller.abort();
  }, []);

  if (isLoading) {
    return (
      <section className="rounded-lg border p-6 text-sm text-muted-foreground">
        読み込み中...
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-lg border p-6 text-sm text-red-600">
        {error}
      </section>
    );
  }

  if (!data) {
    return (
      <section className="rounded-lg border p-6 text-sm text-muted-foreground">
        データがありません
      </section>
    );
  }

  const { portfolio } = data;

  return (
    <section className="rounded-lg border p-6">
      <h2 className="text-lg font-semibold">{portfolio.name}</h2>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-muted-foreground">基準通貨</p>
          <p className="text-lg font-medium">{portfolio.base_currency}</p>
        </div>

        <div>
          <p className="text-sm text-muted-foreground">現金余力</p>
          <p className="text-lg font-medium">
            {Number(portfolio.cash_amount).toLocaleString()}{" "}
            {portfolio.base_currency}
          </p>
        </div>
      </div>

      {portfolio.notes && (
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">メモ</p>
          <p className="mt-1 text-sm">{portfolio.notes}</p>
        </div>
      )}
    </section>
  );
}
