import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";
import type { DailyQuote, FxRate } from "@/lib/prices/price-provider";

export async function saveDailyQuotes(quotes: DailyQuote[]) {
  if (quotes.length === 0) return { savedCount: 0 };

  const db = await createDatabaseClient();
  const { error } = await db.from("price_quotes").upsert(
    quotes.map((quote) => ({
      symbol: quote.symbol,
      market: quote.market,
      quote_date: quote.quoteDate,
      close_price: quote.closePrice,
      currency: quote.currency,
      source: "price-provider",
    })),
    { onConflict: "symbol,market,quote_date" },
  );

  if (error) {
    throw new AppError(
      "DATABASE_ERROR",
      "株価の保存に失敗しました。",
      500,
      error,
    );
  }

  return { savedCount: quotes.length };
}

export async function getLatestQuote(params: {
  symbol: string;
  market: string;
}) {
  const db = await createDatabaseClient();
  const { data, error } = await db
    .from("price_quotes")
    .select("*")
    .eq("symbol", params.symbol)
    .eq("market", params.market)
    .order("quote_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AppError(
      "DATABASE_ERROR",
      "最新株価の取得に失敗しました。",
      500,
      error,
    );
  }

  if (!data) return { quote: null, isStale: false };
  const quote = readDailyQuote(data);
  return { quote, isStale: isQuoteStale(quote.quoteDate) };
}

export async function getLatestQuotes(params: {
  symbols: Array<{ symbol: string; market: string }>;
}) {
  const entries = await Promise.all(
    params.symbols.map(
      async (symbol) =>
        [
          quoteMapKey(symbol.symbol, symbol.market),
          await getLatestQuote(symbol),
        ] as const,
    ),
  );
  return new Map(entries);
}

export async function saveFxRates(rates: FxRate[]) {
  if (rates.length === 0) return { savedCount: 0 };

  const db = await createDatabaseClient();
  const { error } = await db.from("fx_rates").upsert(
    rates.map((rate) => ({
      pair: rate.pair,
      rate_date: rate.rateDate,
      rate: rate.rate,
      source: "price-provider",
    })),
    { onConflict: "pair,rate_date" },
  );

  if (error) {
    throw new AppError(
      "DATABASE_ERROR",
      "為替レートの保存に失敗しました。",
      500,
      error,
    );
  }

  return { savedCount: rates.length };
}

export async function getLatestFxRate(pair: string) {
  const db = await createDatabaseClient();
  const { data, error } = await db
    .from("fx_rates")
    .select("*")
    .eq("pair", pair)
    .order("rate_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AppError(
      "DATABASE_ERROR",
      "最新為替レートの取得に失敗しました。",
      500,
      error,
    );
  }

  if (!data) return { rate: null, isStale: false };
  const rate = readFxRate(data);
  return { rate, isStale: isQuoteStale(rate.rateDate) };
}

export function quoteMapKey(symbol: string, market: string) {
  return `${market}:${symbol}`;
}

export function isQuoteStale(quoteDate: string, now = new Date()) {
  const quoteDay = parseDateOnly(quoteDate);
  const today = parseDateOnly(now.toISOString().slice(0, 10));
  if (quoteDay === null || today === null) return false;
  return Math.floor((today - quoteDay) / 86_400_000) >= 4;
}

function readDailyQuote(row: Record<string, unknown>): DailyQuote {
  return {
    symbol: String(row.symbol),
    market: String(row.market),
    quoteDate: String(row.quote_date),
    closePrice: Number(row.close_price),
    currency: String(row.currency),
  };
}

function readFxRate(row: Record<string, unknown>): FxRate {
  return {
    pair: String(row.pair),
    rateDate: String(row.rate_date),
    rate: Number(row.rate),
  };
}

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}
