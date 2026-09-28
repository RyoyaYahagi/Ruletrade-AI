"use client";

import Link from "next/link";
import { useState } from "react";

import {
  formatPortfolioAmount,
  formatPortfolioQuantity,
} from "@/features/portfolio/format";
import type { ValuedHolding } from "@/features/portfolio/valuation";

function signed(value: number, currency: "JPY" | "USD"): string {
  const formatted = formatPortfolioAmount(Math.abs(value), currency);
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}${formatted}`;
}

function profitTone(value: number | null): string {
  if (value === null || value === 0) return "text-muted-foreground";
  return value > 0
    ? "text-emerald-700 dark:text-emerald-400"
    : "text-red-700 dark:text-red-400";
}

function formatPriceAt(value: string | null): string {
  if (value === null) return "不明";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "不明";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

export function PortfolioHoldingRow({
  valuation,
}: {
  valuation: ValuedHolding;
}) {
  const [expanded, setExpanded] = useState(false);
  const { holding, quote } = valuation;
  const currency = holding.currency;
  const profit = valuation.unrealizedProfitLoss;
  const profitRate = valuation.unrealizedProfitLossRate;
  const code = holding.ticker ?? holding.marketCode ?? "コード不明";

  return (
    <li className="min-w-0 border-b last:border-b-0">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={`holding-details-${holding.stockId}`}
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full min-w-0 items-center justify-between gap-3 rounded-sm px-3 py-3 text-left transition-colors hover:bg-muted/60 active:bg-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary sm:px-4"
      >
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 font-medium">
            {holding.stockName}
          </span>
          <span className="block truncate text-sm text-muted-foreground">
            {code}
          </span>
        </span>
        <span className="shrink-0 text-right tabular-nums">
          <span className="block whitespace-nowrap font-medium">
            {formatPortfolioAmount(
              valuation.marketValue,
              quote?.currency ?? currency,
            )}
          </span>
          <span
            className={`block whitespace-nowrap text-sm ${profitTone(profit)}`}
          >
            {profit === null || currency === null
              ? "損益 不明"
              : `${signed(profit, currency)} (${profitRate === null ? "率 不明" : `${profitRate > 0 ? "+" : profitRate < 0 ? "-" : ""}${Math.abs(profitRate).toFixed(2)}%`})`}
          </span>
        </span>
      </button>
      {expanded && (
        <div
          id={`holding-details-${holding.stockId}`}
          className="grid grid-cols-2 gap-x-4 gap-y-2 border-t bg-muted/20 px-3 py-3 text-sm sm:px-4"
        >
          <span className="text-muted-foreground">保有数量</span>
          <span className="text-right tabular-nums">
            {formatPortfolioQuantity(holding.quantity)}
          </span>
          <span className="text-muted-foreground">参考株価</span>
          <span className="text-right tabular-nums">
            {formatPortfolioAmount(
              quote?.price ?? null,
              quote?.currency ?? currency,
            )}
          </span>
          <span className="text-muted-foreground">参考平均購入単価</span>
          <span className="text-right tabular-nums">
            {formatPortfolioAmount(holding.averagePurchasePrice, currency)}
          </span>
          <span className="text-muted-foreground">参考取得額</span>
          <span className="text-right tabular-nums">
            {formatPortfolioAmount(holding.acquisitionAmount, currency)}
          </span>
          <span className="text-muted-foreground">価格時点</span>
          <span className="text-right tabular-nums">
            {formatPriceAt(quote?.priceAt ?? null)}
          </span>
          {valuation.quoteError && (
            <p className="col-span-2 text-amber-800 dark:text-amber-300">
              {valuation.quoteError}
            </p>
          )}
          {holding.warningReason && (
            <p className="col-span-2 text-amber-800 dark:text-amber-300">
              {holding.warningReason}
            </p>
          )}
          {holding.adjustments.length > 0 && (
            <p className="col-span-2 text-muted-foreground">
              企業アクション: {holding.adjustments.join("、")}
            </p>
          )}
          <Link
            href={`/stocks/${encodeURIComponent(holding.stockId)}`}
            className="col-span-2 mt-1 font-medium text-primary underline-offset-4 hover:underline"
          >
            銘柄詳細を見る →
          </Link>
        </div>
      )}
    </li>
  );
}
