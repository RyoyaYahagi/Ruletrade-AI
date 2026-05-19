"use client";

import { useEffect, useState } from "react";

type DbWatchlist = {
  id: string;
  name: string;
  base_currency: string;
  description: string | null;
};

type SummaryData = {
  watchlist: DbWatchlist;
};

export function WatchlistSummaryCard() {
  const [data, setData] = useState<SummaryData | null>(null);

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/watchlist");
      const json = await response.json();
      if (json.ok) setData(json.data);
    }
    void load();
  }, []);

  if (!data) {
    return (
      <section className="rounded-lg border p-6 text-sm text-muted-foreground">
        Watchlistを読み込み中...
      </section>
    );
  }

  return (
    <section className="rounded-lg border p-6">
      <h2 className="text-lg font-semibold">{data.watchlist.name}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">基準通貨</p>
          <p className="mt-1 font-medium">{data.watchlist.base_currency}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">説明</p>
          <p className="mt-1 font-medium">
            {data.watchlist.description || "未設定"}
          </p>
        </div>
      </div>
    </section>
  );
}
