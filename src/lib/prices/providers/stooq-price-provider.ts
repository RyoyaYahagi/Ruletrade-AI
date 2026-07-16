import type { DailyQuote, FxRate, PriceProvider } from "@/lib/prices/price-provider";

export const MAX_SYMBOLS_PER_RUN = 100;

function stooqSymbol(symbol: string, market: string) {
  const base = symbol.replace(/\.[A-Za-z]+$/, "").toLowerCase();
  if (market === "JP") return `${base}.jp`;
  if (market === "US") return `${base}.us`;
  return base;
}

function parseCsvLine(line: string) {
  return line.split(",").map((value) => value.trim().replace(/^"|"$/g, ""));
}

export function parseStooqCsv(params: {
  csv: string;
  symbol: string;
  market: string;
}) {
  const lines = params.csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return null;
  const header = parseCsvLine(lines[0]).map((value) => value.toLowerCase());
  const row = parseCsvLine(lines[1]);
  const closeIndex = header.indexOf("close");
  const dateIndex = header.indexOf("date");
  if (closeIndex < 0 || dateIndex < 0 || row.includes("N/D")) return null;
  const closePrice = Number(row[closeIndex]);
  const quoteDate = row[dateIndex];
  if (!Number.isFinite(closePrice) || !/^\d{4}-\d{2}-\d{2}$/.test(quoteDate)) return null;
  return {
    symbol: params.symbol,
    market: params.market,
    quoteDate,
    closePrice,
    currency: params.market === "US" ? "USD" : "JPY",
  } satisfies DailyQuote;
}

async function waitForRateLimit() {
  await new Promise((resolve) => setTimeout(resolve, 200));
}

export class StooqPriceProvider implements PriceProvider {
  readonly name = "stooq";

  async fetchDailyQuotes(params: { symbols: Array<{ symbol: string; market: string }> }): Promise<DailyQuote[]> {
    const quotes: DailyQuote[] = [];
    for (const item of params.symbols.slice(0, MAX_SYMBOLS_PER_RUN)) {
      const response = await fetch(
        `https://stooq.com/q/l/?s=${encodeURIComponent(stooqSymbol(item.symbol, item.market))}&f=sd2t2ohlcv&h&e=csv`,
      );
      if (response.ok) {
        const quote = parseStooqCsv({ csv: await response.text(), ...item });
        if (quote) quotes.push(quote);
      }
      await waitForRateLimit();
    }
    return quotes;
  }

  async fetchFxRates(params: { pairs: string[] }): Promise<FxRate[]> {
    const quotes = await this.fetchDailyQuotes({
      symbols: params.pairs.map((pair) => ({ symbol: pair, market: "FX" })),
    });
    return quotes.map((quote) => ({
      pair: quote.symbol,
      rateDate: quote.quoteDate,
      rate: quote.closePrice,
    }));
  }
}
