export function toYahooSymbol(
  ticker: string | null,
  marketCode: string | null,
): string | null {
  const normalized = ticker?.trim().toUpperCase();
  if (!normalized) return null;

  if (marketCode === "JP") {
    const base = normalized.endsWith(".T")
      ? normalized.slice(0, -2)
      : normalized;
    return /^(?:\d{4}|\d{3}[A-Z])$/.test(base) ? `${base}.T` : null;
  }

  if (marketCode === "US") {
    return /^[A-Z][A-Z0-9]*(?:[.-][A-Z0-9]+)*$/.test(normalized)
      ? normalized
      : null;
  }

  return null;
}
