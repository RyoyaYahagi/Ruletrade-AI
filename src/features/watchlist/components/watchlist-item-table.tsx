"use client";

import { useEffect, useState } from "react";

type DbWatchlistItem = {
  id: string;
  ticker: string;
  company_name: string | null;
  status: string;
  priority: string;
  target_price_min: number | null;
  target_price_max: number | null;
  rule_session_id: string | null;
};

export function WatchlistItemTable() {
  const [items, setItems] = useState<DbWatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const response = await fetch("/api/watchlist/items");
      const json = await response.json();
      if (json.ok) setItems(json.data.items);
      setIsLoading(false);
    }
    void load();
  }, []);

  if (isLoading) {
    return (
      <section className="rounded-lg border p-6 text-sm text-muted-foreground">
        アイテムを読み込み中...
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold">Watchlist</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          まだ銘柄が登録されていません。
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border p-6">
      <h2 className="text-lg font-semibold">Watchlist</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">銘柄</th>
              <th className="py-2">状態</th>
              <th className="py-2">優先度</th>
              <th className="py-2 text-right">買付価格</th>
              <th className="py-2 text-right">ルール</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="py-2">
                  <div className="font-medium">{item.ticker}</div>
                  <div className="text-xs text-muted-foreground">{item.company_name}</div>
                </td>
                <td className="py-2">{item.status}</td>
                <td className="py-2">{item.priority}</td>
                <td className="py-2 text-right">
                  {item.target_price_min != null && item.target_price_max != null
                    ? `${item.target_price_min} - ${item.target_price_max}`
                    : "—"}
                </td>
                <td className="py-2 text-right">
                  {item.rule_session_id ? "あり" : "未設定"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
