export function formatTransactionPrice(
  price: number | null,
  currency?: string | null,
) {
  if (price === null) return "価格未入力";
  return `${price.toLocaleString("ja-JP", { maximumFractionDigits: 10 })}${currency === "USD" ? " USD" : "円"}`;
}
