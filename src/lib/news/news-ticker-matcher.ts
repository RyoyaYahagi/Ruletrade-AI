export type TickerCandidate = {
  symbol: string;
  companyName: string | null;
  market: string | null;
};

export type TickerMatch = TickerCandidate & {
  matchMethod: "ticker_code" | "company_name";
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasTickerToken(text: string, symbol: string) {
  const escaped = escapeRegExp(symbol.trim());
  if (!escaped) return false;
  return new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, "i").test(text);
}

function normalizeCompanyName(value: string) {
  return value.replace(/^株式会社|株式会社$/g, "").trim();
}

export function matchNewsToTickers(params: {
  text: string;
  candidates: TickerCandidate[];
}): TickerMatch[] {
  const matches: TickerMatch[] = [];
  for (const candidate of params.candidates) {
    if (hasTickerToken(params.text, candidate.symbol)) {
      matches.push({ ...candidate, matchMethod: "ticker_code" });
      continue;
    }
    const companyName = candidate.companyName?.trim();
    const normalized = companyName ? normalizeCompanyName(companyName) : "";
    if (normalized.length >= 2 && params.text.includes(normalized)) {
      matches.push({ ...candidate, matchMethod: "company_name" });
    }
  }
  return matches;
}
