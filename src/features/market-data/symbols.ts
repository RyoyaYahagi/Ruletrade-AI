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

export const FUND_ISIN_PATTERN = /^JP[0-9A-Z]{9}[0-9]$/;
export const FUND_ASSOCIATION_CODE_PATTERN = /^[0-9A-Z]{8}$/;
const FUND_SYMBOL_PREFIX = "FUND:";

export function toFundSymbol(
  isin: string | null | undefined,
  associationCode: string | null | undefined,
): string | null {
  if (!isin || !associationCode) return null;
  if (
    !FUND_ISIN_PATTERN.test(isin) ||
    !FUND_ASSOCIATION_CODE_PATTERN.test(associationCode)
  )
    return null;
  return `${FUND_SYMBOL_PREFIX}${isin}:${associationCode}`;
}

export function parseFundSymbol(
  symbol: string,
): { isin: string; associationCode: string } | null {
  if (!symbol.startsWith(FUND_SYMBOL_PREFIX)) return null;
  const [isin, associationCode] = symbol
    .slice(FUND_SYMBOL_PREFIX.length)
    .split(":");
  return toFundSymbol(isin, associationCode) === symbol
    ? { isin, associationCode }
    : null;
}

/** 価格を引くときの銘柄の識別子。投資信託のコードがあればそちらを優先する */
export function toQuoteSymbol(holding: {
  ticker: string | null;
  marketCode: string | null;
  fundIsin?: string | null;
  fundAssociationCode?: string | null;
}): string | null {
  return (
    toFundSymbol(holding.fundIsin, holding.fundAssociationCode) ??
    toYahooSymbol(holding.ticker, holding.marketCode)
  );
}
