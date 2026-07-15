"use client";

import { useEffect, useState } from "react";

type DbPosition = {
  id: string;
  ticker: string;
  company_name: string | null;
  market: string | null;
  currency: string | null;
  asset_type: string | null;
  sector: string | null;
  market_value: number;
  rule_session_id: string | null;
};

const DEFAULT_USD_JPY_RATE = 150;

export function PortfolioPositionTable() {
  const [positions, setPositions] = useState<DbPosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showJpy, setShowJpy] = useState(false);
  const [usdJpyRate, setUsdJpyRate] = useState(DEFAULT_USD_JPY_RATE);

  useEffect(() => {
    async function load() {
      setIsLoading(true);

      const response = await fetch("/api/portfolio/positions");
      const json = await response.json();

      if (json.ok) {
        setPositions(json.data.positions);
      }

      setIsLoading(false);
    }

    void load();
  }, []);

  if (isLoading) {
    return (
      <section className="rounded-lg border p-6 text-sm text-muted-foreground">
        保有銘柄を読み込み中...
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

  const hasUsdPositions = positions.some(
    (position) => position.currency === "USD",
  );

  return (
    <section className="rounded-lg border p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">保有銘柄</h2>

        {hasUsdPositions && (
          <div className="flex items-center gap-2 text-sm">
            <label className="flex items-center gap-1.5" htmlFor="portfolio-jpy-toggle">
              <input
                id="portfolio-jpy-toggle"
                type="checkbox"
                checked={showJpy}
                onChange={(event) => setShowJpy(event.target.checked)}
                data-testid="portfolio-jpy-toggle"
              />
              米国株を円換算で表示
            </label>

            {showJpy && (
              <label className="flex items-center gap-1.5 text-muted-foreground">
                為替レート(USD/JPY)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={usdJpyRate}
                  onChange={(event) =>
                    setUsdJpyRate(Number(event.target.value) || 0)
                  }
                  className="w-20 rounded-md border px-2 py-1 text-right"
                  data-testid="portfolio-jpy-rate-input"
                />
              </label>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">銘柄</th>
              <th className="py-2">市場</th>
              <th className="py-2">種類</th>
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
                <td className="py-2">
                  {position.asset_type === "fund"
                    ? "投資信託"
                    : position.asset_type === "stock"
                      ? "個別株"
                      : position.asset_type ?? "—"}
                </td>
                <td className="py-2">{position.sector ?? "未設定"}</td>
                <td className="py-2 text-right">
                  {showJpy && position.currency === "USD" ? (
                    <>
                      <div>
                        {Math.round(
                          Number(position.market_value) * usdJpyRate,
                        ).toLocaleString()}{" "}
                        円
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ${Number(position.market_value).toLocaleString()}
                      </div>
                    </>
                  ) : (
                    Number(position.market_value).toLocaleString()
                  )}
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
