"use client";

import { useEffect, useState } from "react";

export function PortfolioAllocationCharts() {
  const [data, setData] = useState<{
    totalValue: number;
    cashAmount: number;
    assetTypeAllocation: Array<{
      key: string;
      label: string;
      value: number;
      percent: number;
    }>;
    marketAllocation: Array<{
      key: string;
      label: string;
      value: number;
      percent: number;
    }>;
    sectorAllocation: Array<{
      key: string;
      label: string;
      value: number;
      percent: number;
    }>;
  } | null>(null);

  useEffect(() => {
    async function load() {
      const [portfolioRes, positionsRes] = await Promise.all([
        fetch("/api/portfolio"),
        fetch("/api/portfolio/positions"),
      ]);

      const portfolioJson = await portfolioRes.json();
      const positionsJson = await positionsRes.json();

      if (portfolioJson.ok && positionsJson.ok) {
        const cashAmount = Number(
          portfolioJson.data.portfolio.cash_amount ?? 0,
        );
        const positions = positionsJson.data.positions ?? [];
        const totalValue =
          positions.reduce(
            (sum: number, p: { market_value: number | null }) =>
              sum + Number(p.market_value ?? 0),
            0,
          ) + cashAmount;

        const assetTypeMap = new Map<string, number>();
        const marketMap = new Map<string, number>();
        const sectorMap = new Map<string, number>();

        for (const position of positions as Array<{
          market_value: number | null;
          asset_type: string | null;
          market: string | null;
          sector: string | null;
        }>) {
          const value = Number(position.market_value ?? 0);
          if (value <= 0) continue;

          const assetType = position.asset_type ?? "未分類";
          const market = position.market ?? "未分類";
          const sector = position.sector ?? "未分類";

          assetTypeMap.set(
            assetType,
            (assetTypeMap.get(assetType) ?? 0) + value,
          );
          marketMap.set(market, (marketMap.get(market) ?? 0) + value);
          sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + value);
        }

        // 現金も資産タイプ配分に追加
        if (cashAmount > 0) {
          assetTypeMap.set(
            "現金",
            (assetTypeMap.get("現金") ?? 0) + cashAmount,
          );
        }

        setData({
          totalValue,
          cashAmount,
          assetTypeAllocation: Array.from(assetTypeMap.entries()).map(
            ([key, value]) => ({
              key,
              label: key,
              value: Number(value.toFixed(2)),
              percent:
                totalValue === 0
                  ? 0
                  : Number(((value / totalValue) * 100).toFixed(2)),
            }),
          ),
          marketAllocation: Array.from(marketMap.entries()).map(
            ([key, value]) => ({
              key,
              label: key,
              value: Number(value.toFixed(2)),
              percent:
                totalValue === 0
                  ? 0
                  : Number(((value / totalValue) * 100).toFixed(2)),
            }),
          ),
          sectorAllocation: Array.from(sectorMap.entries()).map(
            ([key, value]) => ({
              key,
              label: key,
              value: Number(value.toFixed(2)),
              percent:
                totalValue === 0
                  ? 0
                  : Number(((value / totalValue) * 100).toFixed(2)),
            }),
          ),
        });
      }
    }

    void load();
  }, []);

  if (!data) {
    return (
      <section className="rounded-lg border p-6 text-sm text-muted-foreground">
        配分情報を読み込み中...
      </section>
    );
  }

  if (data.totalValue === 0) {
    return (
      <section className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold">資産配分</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          保有銘柄が登録されていないため、配分情報を表示できません。
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border p-6">
      <h2 className="text-lg font-semibold">資産配分</h2>

      <div className="mt-4 grid gap-6 sm:grid-cols-3">
        <AllocationCard title="資産タイプ別" items={data.assetTypeAllocation} />
        <AllocationCard title="市場別" items={data.marketAllocation} />
        <AllocationCard title="セクター別" items={data.sectorAllocation} />
      </div>
    </section>
  );
}

function AllocationCard({
  title,
  items,
}: {
  title: string;
  items: Array<{
    key: string;
    label: string;
    value: number;
    percent: number;
  }>;
}) {
  return (
    <div>
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="mt-2 space-y-1">
        {items
          .sort((a, b) => b.percent - a.percent)
          .map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between text-sm"
            >
              <span>{item.label}</span>
              <span className="text-muted-foreground">{item.percent}%</span>
            </div>
          ))}
      </div>
    </div>
  );
}
