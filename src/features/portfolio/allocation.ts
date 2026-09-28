import type { ValuationSummary } from "@/features/portfolio/valuation";

export type AllocationItem = NonNullable<
  ValuationSummary["composition"]
>[number];

export function getAllocationItems(
  composition: ValuationSummary["composition"],
): AllocationItem[] | null {
  if (composition === null) return null;

  const sorted = [...composition].sort(
    (a, b) =>
      b.marketValue - a.marketValue ||
      a.stockName.localeCompare(b.stockName, "ja"),
  );
  if (sorted.length <= 5) return sorted;

  const top = sorted.slice(0, 5);
  const others = sorted.slice(5);
  const otherValue = others.reduce((sum, item) => sum + item.marketValue, 0);
  const totalValue = sorted.reduce((sum, item) => sum + item.marketValue, 0);

  return [
    ...top,
    {
      stockId: "__other__",
      stockName: "その他",
      marketValue: otherValue,
      percent: (otherValue / totalValue) * 100,
    },
  ];
}
