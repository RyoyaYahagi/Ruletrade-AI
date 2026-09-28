import "server-only";

import YahooFinance from "yahoo-finance2";

export type MarketQuote = {
  symbol: string;
  price: number;
  currency: "JPY" | "USD";
  priceAt: string | null;
  marketState: string | null;
  delayedByMinutes: number | null;
  sourceName: string | null;
};

export interface MarketPriceProvider {
  getQuotes(symbols: readonly string[]): Promise<Map<string, MarketQuote>>;
}

const yahooFinance = new YahooFinance();
const CACHE_TTL_MS = 5 * 60 * 1000;
// The cache is process-local and lasts five minutes; it is not shared across workers.
const quoteCache = new Map<
  string,
  { quote: MarketQuote | null; expiresAt: number }
>();
const pendingQuotes = new Map<string, Promise<MarketQuote | null>>();

function toMarketQuote(
  symbol: string,
  quote: Awaited<ReturnType<typeof yahooFinance.quote>> | undefined,
): MarketQuote | null {
  if (!quote) return null;

  const price = quote.regularMarketPrice;
  const currency = quote.currency;
  const priceAt = quote.regularMarketTime;
  const marketState = quote.marketState;
  const delayedByMinutes = quote.exchangeDataDelayedBy;
  const sourceName = quote.quoteSourceName;
  if (
    typeof price !== "number" ||
    !Number.isFinite(price) ||
    price <= 0 ||
    (currency !== "JPY" && currency !== "USD")
  ) {
    return null;
  }
  const validPriceAt =
    priceAt instanceof Date && Number.isFinite(priceAt.getTime())
      ? priceAt.toISOString()
      : null;
  const validDelay =
    typeof delayedByMinutes === "number" &&
    Number.isFinite(delayedByMinutes) &&
    delayedByMinutes >= 0
      ? delayedByMinutes
      : null;

  return {
    symbol,
    price,
    currency,
    priceAt: validPriceAt,
    marketState: typeof marketState === "string" ? marketState : null,
    delayedByMinutes: validDelay,
    sourceName: typeof sourceName === "string" ? sourceName : null,
  };
}

async function fetchQuotes(
  symbols: readonly string[],
): Promise<Map<string, MarketQuote>> {
  const quotes = new Map<string, MarketQuote>();
  if (symbols.length === 0) return quotes;

  try {
    const response = await yahooFinance.quote([...symbols], { return: "map" });
    for (const symbol of symbols) {
      const quote = toMarketQuote(symbol, response.get(symbol));
      if (quote) quotes.set(symbol, quote);
    }
  } catch {
    const individualQuotes = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          return toMarketQuote(symbol, await yahooFinance.quote(symbol));
        } catch {
          return null;
        }
      }),
    );
    for (const quote of individualQuotes) {
      if (quote) quotes.set(quote.symbol, quote);
    }
  }

  return quotes;
}

async function fetchAndCache(
  symbols: readonly string[],
): Promise<Map<string, MarketQuote>> {
  const requested = new Set(symbols);
  const batch = fetchQuotes(symbols);
  for (const symbol of symbols) {
    pendingQuotes.set(
      symbol,
      batch.then((quotes) => quotes.get(symbol) ?? null),
    );
  }

  const result = await batch;
  const now = Date.now();
  for (const symbol of symbols) {
    const quote = result.get(symbol);
    quoteCache.set(symbol, {
      quote: quote ?? null,
      expiresAt: now + CACHE_TTL_MS,
    });
    pendingQuotes.delete(symbol);
  }
  return new Map([...result].filter(([symbol]) => requested.has(symbol)));
}

export const yahooMarketPriceProvider: MarketPriceProvider = {
  async getQuotes(symbols) {
    // End-to-end browser runs stay deterministic and never contact Yahoo Finance.
    if (process.env.RULETRADE_E2E_DISABLE_MARKET_QUOTES === "1") {
      return new Map();
    }

    const uniqueSymbols = [
      ...new Set(symbols.filter((symbol) => symbol.trim())),
    ];
    const now = Date.now();
    const result = new Map<string, MarketQuote>();
    const uncached: string[] = [];
    const pending: Promise<MarketQuote | null>[] = [];

    for (const symbol of uniqueSymbols) {
      const cached = quoteCache.get(symbol);
      if (cached && cached.expiresAt > now) {
        if (cached.quote) result.set(symbol, cached.quote);
      } else {
        if (cached) quoteCache.delete(symbol);
        const inFlight = pendingQuotes.get(symbol);
        if (inFlight) pending.push(inFlight);
        else uncached.push(symbol);
      }
    }

    const fetched = await fetchAndCache(uncached);
    for (const [symbol, quote] of fetched) result.set(symbol, quote);
    for (const promise of pending) {
      const quote = await promise;
      if (quote) result.set(quote.symbol, quote);
    }
    return result;
  },
};
