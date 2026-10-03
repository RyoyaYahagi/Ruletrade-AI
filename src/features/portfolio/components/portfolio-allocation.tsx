import { getAllocationItems } from "@/features/portfolio/allocation";
import type { ValuationSummary } from "@/features/portfolio/valuation";

const allocationColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

function formatPercent(value: number): string {
  return `${value.toLocaleString("ja-JP", { maximumFractionDigits: 1 })}%`;
}

export function PortfolioAllocation({
  summary,
}: {
  summary: ValuationSummary;
}) {
  const items = getAllocationItems(summary.composition);
  if (!items) return null;

  // 上位5銘柄の後ろに「その他」が来るため、6色目（灰色）は常に「その他」に割り当たる。
  return (
    <section aria-label="時価評価額の構成比" className="min-w-0">
      <div className="flex items-center gap-5">
        <div className="relative size-32 shrink-0">
          <svg
            viewBox="0 0 42 42"
            role="img"
            aria-label={`${summary.currency}建て保有銘柄の構成比`}
            className="size-full -rotate-90"
          >
            {items.map((item, index) => {
              const offset = items
                .slice(0, index)
                .reduce((sum, previous) => sum + previous.percent, 0);
              const gap = items.length > 1 ? 0.6 : 0;
              return (
                <circle
                  key={item.stockId}
                  cx="21"
                  cy="21"
                  r="15.915"
                  fill="none"
                  stroke={allocationColors[index % allocationColors.length]}
                  strokeWidth="8"
                  strokeDasharray={`${Math.max(item.percent - gap, 0)} ${100 - item.percent + gap}`}
                  strokeDashoffset={-offset}
                  pathLength="100"
                />
              );
            })}
          </svg>
          <span
            aria-hidden="true"
            className="absolute inset-0 flex flex-col items-center justify-center"
          >
            <span className="font-mono text-xl">{summary.composition?.length}</span>
            <span className="text-[11px] text-muted-foreground">銘柄</span>
          </span>
        </div>
        <ul aria-label="構成比の凡例" className="min-w-0 flex-1 space-y-2.5 text-sm">
          {items.map((item, index) => (
            <li
              key={item.stockId}
              className="flex min-w-0 items-center justify-between gap-3"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-[3px]"
                  style={{
                    backgroundColor:
                      allocationColors[index % allocationColors.length],
                  }}
                />
                <span className="truncate">{item.stockName}</span>
              </span>
              <span className="shrink-0 font-mono">
                {formatPercent(item.percent)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
