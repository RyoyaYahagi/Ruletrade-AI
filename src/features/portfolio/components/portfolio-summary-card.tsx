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

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/portfolio");
      const json = await response.json();

      if (json.ok) {
        setData(json.data);
      }
    }

    void load();
  }, []);

  if (!data) {
    return (
      <section className="rounded-lg border p-6 text-sm text-muted-foreground">
        ポートフォリオを読み込み中...
      </section>
    );
  }

  return (
    <section className="rounded-lg border p-6">
      <h2 className="text-lg font-semibold">{data.portfolio.name}</h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">基準通貨</p>
          <p className="mt-1 font-medium">{data.portfolio.base_currency}</p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">現金</p>
          <p className="mt-1 font-medium">
            {Number(data.portfolio.cash_amount).toLocaleString()}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">メモ</p>
          <p className="mt-1 font-medium">{data.portfolio.notes || "未設定"}</p>
        </div>
      </div>
    </section>
  );
}
