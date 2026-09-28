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

  return (
    <section aria-label="時価評価額の構成比" className="min-w-0">
      <div className="grid items-center gap-5 sm:grid-cols-[minmax(9rem,0.8fr)_minmax(0,1.2fr)] sm:gap-8">
        <svg
          viewBox="0 0 42 42"
          role="img"
          aria-label={`${summary.currency}建て保有銘柄の構成比`}
          className="mx-auto h-56 w-56 max-w-full -rotate-90"
        >
          <circle
            cx="21"
            cy="21"
            r="15.915"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeWidth="8"
          />
          {items.map((item, index) => {
            const offset = items
              .slice(0, index)
              .reduce((sum, previous) => sum + previous.percent, 0);
            return (
              <circle
                key={item.stockId}
                cx="21"
                cy="21"
                r="15.915"
                fill="none"
                stroke={allocationColors[index % allocationColors.length]}
                strokeWidth="8"
                strokeDasharray={`${item.percent} ${100 - item.percent}`}
                strokeDashoffset={-offset}
                pathLength="100"
              />
            );
          })}
        </svg>
        <ul aria-label="構成比の凡例" className="min-w-0 space-y-3 text-sm">
          {items.map((item, index) => (
            <li
              key={item.stockId}
              className="flex min-w-0 items-center justify-between gap-4"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      allocationColors[index % allocationColors.length],
                  }}
                />
                <span className="truncate">{item.stockName}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                {formatPercent(item.percent)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
