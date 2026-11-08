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

/**
 * 価格を引くときの銘柄の識別子。投資信託のコードがあればそちらを優先し、
 * 基準価額が固定の投資信託は固定の単価を表す識別子を返す
 */
export function toQuoteSymbol(holding: {
  ticker: string | null;
  marketCode: string | null;
  stockName?: string | null;
  fundIsin?: string | null;
  fundAssociationCode?: string | null;
}): string | null {
  return (
    toFundSymbol(holding.fundIsin, holding.fundAssociationCode) ??
    toYahooSymbol(holding.ticker, holding.marketCode) ??
    (holding.ticker === null && holding.stockName
      ? toConstantNavSymbol(holding.stockName)
      : null)
  );
}

// 基準価額が仕組みとして固定されている投資信託。分配金は口数の追加で払われ、1口あたりの価格は動かない。
// 外国籍の米ドル MMF は投資信託協会のデータに無く、価格を引く先が無いため、取引記録と同じ固定の単価で評価する。
// 楽天の取引履歴でも、この2本の単価は常に下の値で記録されている。
const CONSTANT_NAV_FUNDS = new Map<
  string,
  { price: number; currency: "JPY" | "USD" }
>([
  [
    "ノーザン・トラスト・米ドル・リクイディティ・ファンド(楽天・米ドルMMF)",
    { price: 0.01, currency: "USD" },
  ],
  ["楽天・マネーファンド", { price: 1, currency: "JPY" }],
]);
const CONSTANT_NAV_PREFIX = "CONSTANT:";

export function toConstantNavSymbol(stockName: string): string | null {
  const fund = CONSTANT_NAV_FUNDS.get(stockName.normalize("NFKC").trim());
  return fund ? `${CONSTANT_NAV_PREFIX}${fund.currency}:${fund.price}` : null;
}

export function parseConstantNavSymbol(
  symbol: string,
): { price: number; currency: "JPY" | "USD" } | null {
  if (!symbol.startsWith(CONSTANT_NAV_PREFIX)) return null;
  const [currency, price] = symbol.slice(CONSTANT_NAV_PREFIX.length).split(":");
  const known = [...CONSTANT_NAV_FUNDS.values()].find(
    (fund) => fund.currency === currency && String(fund.price) === price,
  );
  return known ?? null;
}
