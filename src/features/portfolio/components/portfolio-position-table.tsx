"use client";

import { useEffect, useState } from "react";

type DbPosition = {
  id: string;
  ticker: string;
  company_name: string | null;
  market: string | null;
  sector: string | null;
  market_value: number;
  rule_session_id: string | null;
};

export function PortfolioPositionTable() {
  const [positions, setPositions] = useState<DbPosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/portfolio/positions", {
          signal: controller.signal,
        });
        const json = await response.json();

        if (json.ok) {
          setPositions(json.data.positions);
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
        保有銘柄を読み込み中...
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

  if (positions.length === 0) {
    return (
      <section className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold">保有銘柄</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          まだ保有銘柄が登録されていません。
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border p-6">
      <h2 className="text-lg font-semibold">保有銘柄</h2>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">銘柄</th>
              <th className="py-2">市場</th>
              <th className="py-2">セクター</th>
              <th className="py-2 text-right">評価額</th>
              <th className="py-2 text-right">ルール</th>
            </tr>
          </thead>

          <tbody>
            {positions.map((position) => (
              <tr key={position.id} className="border-b">
                <td className="py-2">
                  <div className="font-medium">{position.ticker}</div>
                  <div className="text-xs text-muted-foreground">
                    {position.company_name}
                  </div>
                </td>
                <td className="py-2">{position.market ?? "—"}</td>
                <td className="py-2">{position.sector ?? "未設定"}</td>
                <td className="py-2 text-right">
                  {Number(position.market_value).toLocaleString()}
                </td>
                <td className="py-2 text-right">
                  {position.rule_session_id ? "あり" : "未設定"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
