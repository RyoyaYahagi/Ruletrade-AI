import "server-only";

import type {
  DailyQuote,
  FxRate,
  PriceProvider,
} from "@/lib/prices/price-provider";

export const MAX_SYMBOLS_PER_RUN = 100;
const STOOQ_ENDPOINT = "https://stooq.com/q/l/";
const REQUEST_INTERVAL_MS = 200;

export class StooqPriceProvider implements PriceProvider {
  readonly name = "stooq";

  async fetchDailyQuotes(params: {
    symbols: Array<{ symbol: string; market: string }>;
  }): Promise<DailyQuote[]> {
    const quotes: DailyQuote[] = [];
    const symbols = params.symbols.slice(0, MAX_SYMBOLS_PER_RUN);

    for (const [index, symbol] of symbols.entries()) {
      if (index > 0) await wait(REQUEST_INTERVAL_MS);

      const csv = await this.fetchCsv(
        toStooqSymbol(symbol.symbol, symbol.market),
      );
      if (!csv) continue;

      const quote = parseStooqCsv(csv, symbol);
      if (quote) quotes.push(quote);
    }

    return quotes;
  }

  async fetchFxRates(params: { pairs: string[] }): Promise<FxRate[]> {
    const rates: FxRate[] = [];
    const pairs = params.pairs.slice(0, MAX_SYMBOLS_PER_RUN);

    for (const [index, pair] of pairs.entries()) {
      if (index > 0) await wait(REQUEST_INTERVAL_MS);

      const csv = await this.fetchCsv(toStooqSymbol(pair, "FX"));
      if (!csv) continue;

      const quote = parseStooqCsv(csv, {
        symbol: pair,
        market: "FX",
      });
      if (quote) {
        rates.push({
          pair,
          rateDate: quote.quoteDate,
          rate: quote.closePrice,
        });
      }
    }

    return rates;
  }

  private async fetchCsv(symbol: string) {
    const url = new URL(STOOQ_ENDPOINT);
    url.searchParams.set("s", symbol);
    url.searchParams.set("f", "sd2t2ohlcv");
    url.searchParams.set("h", "");
    url.searchParams.set("e", "csv");

    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      return await response.text();
    } catch {
      return null;
    }
  }
}

export function parseStooqCsv(
  csv: string,
  params: { symbol: string; market: string },
): DailyQuote | null {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return null;

  const headers = parseCsvLine(lines[0]);
  const values = parseCsvLine(lines[1]);
  const row = Object.fromEntries(
    headers.map((header, index) => [header.toLowerCase(), values[index] ?? ""]),
  );

  const quoteDate = row.date;
  const closePrice = Number(row.close);
  if (!quoteDate || quoteDate === "N/D" || !Number.isFinite(closePrice)) {
    return null;
  }

  return {
    symbol: params.symbol,
    market: params.market,
    quoteDate,
    closePrice,
    currency: params.market === "US" ? "USD" : "JPY",
  };
}

export function toStooqSymbol(symbol: string, market: string) {
  const normalized = symbol.trim();
  if (market === "JP") {
    return `${normalized.replace(/\.(?:t|jp)$/i, "")}.jp`.toLowerCase();
  }
  if (market === "US") {
    return `${normalized.replace(/\.us$/i, "")}.us`.toLowerCase();
  }
  if (market === "FX") return normalized.toLowerCase();
  return normalized.toLowerCase();
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;

  for (const character of line) {
    if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }

  values.push(value);
  return values.map((item) => item.trim());
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}
