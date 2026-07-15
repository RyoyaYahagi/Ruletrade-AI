"use client";

import { useEffect, useState } from "react";

type AllocationSlice = {
  key: string;
  label: string;
  value: number;
  percent: number;
};

const ASSET_TYPE_LABELS: Record<string, string> = {
  stock: "個別株",
  etf: "ETF",
  fund: "投資信託",
  reit: "REIT",
  cash_like: "現金類似",
  other: "その他",
  unknown: "未分類",
};

const MARKET_LABELS: Record<string, string> = {
  JP: "日本",
  US: "米国",
  OTHER: "その他",
  unknown: "未設定",
};

const PIE_COLORS = [
  "#2563eb",
  "#16a34a",
  "#f97316",
  "#9333ea",
  "#db2777",
  "#0891b2",
  "#ca8a04",
  "#4f46e5",
  "#65a30d",
  "#dc2626",
];

function getAssetTypeLabel(assetType: string) {
  return ASSET_TYPE_LABELS[assetType] ?? assetType;
}

function getMarketLabel(market: string) {
  return MARKET_LABELS[market] ?? market;
}

function toSlices(
  map: Map<string, number>,
  totalValue: number,
  labelForKey: (key: string) => string = (key) => key,
): AllocationSlice[] {
  return Array.from(map.entries())
    .map(([key, value]) => ({
      key,
      label: labelForKey(key),
      value: Number(value.toFixed(2)),
      percent:
        totalValue === 0
          ? 0
          : Number(((value / totalValue) * 100).toFixed(2)),
    }))
    .sort((a, b) => b.value - a.value);
}

export function PortfolioAllocationCharts() {
  const [data, setData] = useState<{
    totalValue: number;
    cashAmount: number;
    assetTypeAllocation: AllocationSlice[];
    marketAllocation: AllocationSlice[];
    sectorAllocation: AllocationSlice[];
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
            (sum: number, p: { market_value: number | string | null }) =>
              sum + Number(p.market_value ?? 0),
            0,
          ) + cashAmount;

        const assetTypeMap = new Map<string, number>();
        const marketMap = new Map<string, number>();
        const sectorMap = new Map<string, number>();

        for (const position of positions as Array<{
          market_value: number | string | null;
          asset_type: string | null;
          market: string | null;
          sector: string | null;
        }>) {
          const value = Number(position.market_value ?? 0);
          if (value <= 0) continue;

          const assetType = position.asset_type ?? "unknown";
          const market = position.market ?? "unknown";
          const sector = position.sector ?? "未分類";

          assetTypeMap.set(
            assetType,
            (assetTypeMap.get(assetType) ?? 0) + value,
          );
          marketMap.set(market, (marketMap.get(market) ?? 0) + value);
          sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + value);
        }

        if (cashAmount > 0) {
          assetTypeMap.set(
            "現金",
            (assetTypeMap.get("現金") ?? 0) + cashAmount,
          );
        }

        setData({
          totalValue,
          cashAmount,
          assetTypeAllocation: toSlices(
            assetTypeMap,
            totalValue,
            getAssetTypeLabel,
          ),
          marketAllocation: toSlices(marketMap, totalValue, getMarketLabel),
          sectorAllocation: toSlices(sectorMap, totalValue),
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

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <div className="rounded-md border p-4">
          <h3 className="text-sm font-medium">資産タイプ別（円グラフ）</h3>
          <AllocationPieChart items={data.assetTypeAllocation} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <AllocationCard title="資産タイプ別" items={data.assetTypeAllocation} />
          <AllocationCard title="市場別" items={data.marketAllocation} />
          <AllocationCard title="セクター別" items={data.sectorAllocation} />
        </div>
      </div>
    </section>
  );
}

function AllocationPieChart({ items }: { items: AllocationSlice[] }) {
  const gradientStops: string[] = [];
  let cursor = 0;

  items.forEach((item, index) => {
    const end = index === items.length - 1 ? 100 : cursor + item.percent;
    gradientStops.push(`${PIE_COLORS[index % PIE_COLORS.length]} ${cursor}% ${end}%`);
    cursor = end;
  });

  const gradient =
    gradientStops.length > 0
      ? `conic-gradient(${gradientStops.join(", ")})`
      : "#e5e7eb";

  return (
    <div className="mt-4 grid items-center gap-4 sm:grid-cols-[minmax(150px,220px)_1fr]">
      <div
        className="mx-auto aspect-square w-full max-w-[220px] rounded-full"
        style={{ background: gradient }}
        role="img"
        aria-label={`資産タイプ別の配分: ${items
          .map((item) => `${item.label}${item.percent}%`)
          .join("、")}`}
      />
      <ul className="space-y-2 text-sm">
        {items.map((item, index) => (
          <li key={item.key} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                aria-hidden="true"
              />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="shrink-0 text-muted-foreground">
              {item.percent}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AllocationCard({
  title,
  items,
}: {
  title: string;
  items: AllocationSlice[];
}) {
  return (
    <div>
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="mt-2 space-y-1">
        {[...items]
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
