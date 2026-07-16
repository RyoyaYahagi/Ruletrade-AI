"use client";

import { useEffect, useMemo, useState } from "react";

type DbPosition = {
  id: string;
  ticker: string;
  company_name: string | null;
  market: string | null;
  currency: string | null;
  asset_type: string | null;
  sector: string | null;
  current_price: number | string | null;
  price_updated_at: string | null;
  market_value: number | string | null;
  rule_session_id: string | null;
};

type SortKey = "marketValueDesc" | "marketValueAsc" | "tickerAsc" | "nameAsc";

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

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "marketValueDesc", label: "評価額が大きい順" },
  { value: "marketValueAsc", label: "評価額が小さい順" },
  { value: "tickerAsc", label: "銘柄コード順" },
  { value: "nameAsc", label: "銘柄名順" },
];

const DEFAULT_USD_JPY_RATE = 150;

function getAssetTypeLabel(assetType: string | null) {
  return ASSET_TYPE_LABELS[assetType ?? "unknown"] ?? assetType ?? "未分類";
}

function getMarketLabel(market: string | null) {
  return MARKET_LABELS[market ?? "unknown"] ?? market ?? "未設定";
}

function getMarketValue(position: DbPosition) {
  return Number(position.market_value ?? 0);
}

function isStalePrice(timestamp: string | null) {
  if (!timestamp) return false;
  return Date.now() - Date.parse(timestamp) >= 4 * 24 * 60 * 60 * 1000;
}

export function PortfolioPositionTable() {
  const [positions, setPositions] = useState<DbPosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [marketFilter, setMarketFilter] = useState("all");
  const [assetTypeFilter, setAssetTypeFilter] = useState("all");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("marketValueDesc");
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

  const sectors = useMemo(
    () =>
      Array.from(
        new Set(positions.map((position) => position.sector ?? "未設定")),
      ).sort((a, b) => a.localeCompare(b, "ja")),
    [positions],
  );

  const filteredPositions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const nextPositions = positions.filter((position) => {
      const market = position.market ?? "unknown";
      const assetType = position.asset_type ?? "unknown";
      const sector = position.sector ?? "未設定";
      const searchableText = [
        position.ticker,
        position.company_name ?? "",
        sector,
      ]
        .join(" ")
        .toLowerCase();

      return (
        (normalizedSearch === "" || searchableText.includes(normalizedSearch)) &&
        (marketFilter === "all" || market === marketFilter) &&
        (assetTypeFilter === "all" || assetType === assetTypeFilter) &&
        (sectorFilter === "all" || sector === sectorFilter)
      );
    });

    return nextPositions.sort((a, b) => {
      if (sortKey === "marketValueDesc") {
        return getMarketValue(b) - getMarketValue(a);
      }
      if (sortKey === "marketValueAsc") {
        return getMarketValue(a) - getMarketValue(b);
      }
      if (sortKey === "nameAsc") {
        return (a.company_name ?? a.ticker).localeCompare(
          b.company_name ?? b.ticker,
          "ja",
        );
      }
      return a.ticker.localeCompare(b.ticker, "ja");
    });
  }, [assetTypeFilter, marketFilter, positions, searchTerm, sectorFilter, sortKey]);

  function clearFilters() {
    setSearchTerm("");
    setMarketFilter("all");
    setAssetTypeFilter("all");
    setSectorFilter("all");
  }

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

  const hasFilters =
    searchTerm !== "" ||
    marketFilter !== "all" ||
    assetTypeFilter !== "all" ||
    sectorFilter !== "all";

  const hasUsdPositions = positions.some(
    (position) => position.currency === "USD",
  );

  return (
    <section className="rounded-lg border p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">保有銘柄</h2>
        <p className="text-sm text-muted-foreground">
          {filteredPositions.length} / {positions.length}件表示
        </p>
      </div>

      {hasUsdPositions && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
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

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <label htmlFor="position-search" className="block text-xs font-medium">
            銘柄を検索
          </label>
          <input
            id="position-search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="銘柄コード・銘柄名・セクター"
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            data-testid="portfolio-position-search"
          />
        </div>
        <div>
          <label htmlFor="position-sort" className="block text-xs font-medium">
            並べ替え
          </label>
          <select
            id="position-sort"
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            data-testid="portfolio-position-sort"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="position-market-filter" className="block text-xs font-medium">
            市場
          </label>
          <select
            id="position-market-filter"
            value={marketFilter}
            onChange={(event) => setMarketFilter(event.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            data-testid="portfolio-position-market-filter"
          >
            <option value="all">すべて</option>
            {Object.entries(MARKET_LABELS)
              .filter(([value]) => value !== "unknown")
              .map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label htmlFor="position-asset-type-filter" className="block text-xs font-medium">
            種類
          </label>
          <select
            id="position-asset-type-filter"
            value={assetTypeFilter}
            onChange={(event) => setAssetTypeFilter(event.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            data-testid="portfolio-position-asset-type-filter"
          >
            <option value="all">すべて</option>
            {Object.entries(ASSET_TYPE_LABELS)
              .filter(([value]) => value !== "unknown")
              .map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label htmlFor="position-sector-filter" className="block text-xs font-medium">
            セクター
          </label>
          <select
            id="position-sector-filter"
            value={sectorFilter}
            onChange={(event) => setSectorFilter(event.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            data-testid="portfolio-position-sector-filter"
          >
            <option value="all">すべて</option>
            {sectors.map((sector) => (
              <option key={sector} value={sector}>
                {sector}
              </option>
            ))}
          </select>
        </div>
      </div>

      {hasFilters ? (
        <button
          type="button"
          onClick={clearFilters}
          className="mt-3 text-sm text-muted-foreground underline"
          data-testid="portfolio-position-clear-filters"
        >
          フィルターをクリア
        </button>
      ) : null}

      {filteredPositions.length === 0 ? (
        <p className="mt-4 rounded-md bg-muted p-4 text-sm text-muted-foreground">
          条件に一致する保有銘柄がありません。
        </p>
      ) : (
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
              {filteredPositions.map((position) => (
                <tr key={position.id} className="border-b">
                  <td className="py-2">
                    <div className="font-medium">{position.ticker}</div>
                    <div className="text-xs text-muted-foreground">
                      {position.company_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {position.price_updated_at
                        ? `終値 ${Number(position.current_price ?? 0).toLocaleString()}円（${position.price_updated_at.slice(0, 10)}時点）`
                        : "手動入力値"}
                      {isStalePrice(position.price_updated_at) ? " ・ 4日以上未更新" : ""}
                    </div>
                  </td>
                  <td className="py-2">{getMarketLabel(position.market)}</td>
                  <td className="py-2">
                    {getAssetTypeLabel(position.asset_type)}
                  </td>
                  <td className="py-2">{position.sector ?? "未設定"}</td>
                  <td className="py-2 text-right">
                    {showJpy && position.currency === "USD" ? (
                      <>
                        <div>
                          {Math.round(
                            getMarketValue(position) * usdJpyRate,
                          ).toLocaleString()}{" "}
                          円
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ${getMarketValue(position).toLocaleString()}
                        </div>
                      </>
                    ) : (
                      getMarketValue(position).toLocaleString()
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
      )}
    </section>
  );
}
