import type { PortfolioHolding } from "./portfolio";

// Snap only floating-point noise at the display boundary; aggregation keeps full precision.
function displayValue(value: number, digits: number): number {
  const scale = 10 ** digits;
  const scaled = value * scale;
  const nearest = Math.round(scaled);
  const epsilon = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 8;
  return Math.abs(scaled - nearest) <= epsilon ? nearest / scale : value;
}

export function formatPortfolioQuantity(quantity: number): string {
  const value = displayValue(quantity, 0);
  if (value > 0 && value < 1) return "1株未満";
  if (value < 0 && value > -1) return "-1株未満";
  return `${value.toLocaleString("ja-JP", {
    maximumFractionDigits: 0,
    roundingMode: "trunc",
  })}株`;
}

export function formatPortfolioAmount(
  value: number | null,
  currency: PortfolioHolding["currency"],
): string {
  if (value === null || currency === null) return "不明";
  const digits = currency === "USD" ? 2 : 0;
  const amount = displayValue(value, digits).toLocaleString("ja-JP", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    roundingMode: "trunc",
  });
  return currency === "USD" ? `${amount} USD` : `${amount}円`;
}
