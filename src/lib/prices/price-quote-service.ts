import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import type { DailyQuote, FxRate } from "@/lib/prices/price-provider";

const STALE_AFTER_CALENDAR_DAYS = 4;

function isStale(quoteDate: string) {
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`).getTime();
  const date = new Date(`${quoteDate}T00:00:00Z`).getTime();
  return Number.isFinite(date) && today - date >= STALE_AFTER_CALENDAR_DAYS * 24 * 60 * 60 * 1000;
}

export async function saveDailyQuotes(quotes: DailyQuote[], params?: { source?: string }) {
  const db = await createDatabaseClient();
  let savedCount = 0;
  for (const quote of quotes) {
    const { data: existing, error: findError } = await db
      .from("price_quotes")
      .select("id")
      .eq("symbol", quote.symbol)
      .eq("market", quote.market)
      .eq("quote_date", quote.quoteDate)
      .maybeSingle();
    if (findError) throw findError;

    const result = existing
      ? await db
          .from("price_quotes")
          .update({ close_price: quote.closePrice, currency: quote.currency, source: params?.source ?? "unknown" })
          .eq("id", existing.id)
      : await db.from("price_quotes").insert({
          symbol: quote.symbol,
          market: quote.market,
          quote_date: quote.quoteDate,
          close_price: quote.closePrice,
          currency: quote.currency,
          source: params?.source ?? "unknown",
        });
    if (result.error) throw result.error;
    savedCount += 1;
  }
  return { savedCount };
}

export async function getLatestQuote(params: { symbol: string; market: string }) {
  const db = await createDatabaseClient();
  const { data, error } = await db
    .from("price_quotes")
    .select("*")
    .eq("symbol", params.symbol)
    .eq("market", params.market)
    .order("quote_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { quote: null, isStale: false };
  return {
    quote: {
      symbol: String(data.symbol),
      market: String(data.market),
      quoteDate: String(data.quote_date),
      closePrice: Number(data.close_price),
      currency: String(data.currency),
    } satisfies DailyQuote,
    isStale: isStale(String(data.quote_date)),
  };
}

export async function getLatestQuotes(params: { symbols: Array<{ symbol: string; market: string }> }) {
  const result = new Map<string, { quote: DailyQuote | null; isStale: boolean }>();
  for (const symbol of params.symbols) {
    result.set(`${symbol.market}:${symbol.symbol}`, await getLatestQuote(symbol));
  }
  return result;
}

export async function saveFxRates(rates: FxRate[], params?: { source?: string }) {
  const db = await createDatabaseClient();
  let savedCount = 0;
  for (const rate of rates) {
    const { data: existing, error: findError } = await db
      .from("fx_rates")
      .select("id")
      .eq("pair", rate.pair)
      .eq("rate_date", rate.rateDate)
      .maybeSingle();
    if (findError) throw findError;
    const result = existing
      ? await db.from("fx_rates").update({ rate: rate.rate, source: params?.source ?? "unknown" }).eq("id", existing.id)
      : await db.from("fx_rates").insert({
          pair: rate.pair,
          rate_date: rate.rateDate,
          rate: rate.rate,
          source: params?.source ?? "unknown",
        });
    if (result.error) throw result.error;
    savedCount += 1;
  }
  return { savedCount };
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
  if (error) throw error;
  if (!data) return { rate: null, isStale: false };
  return { rate: Number(data.rate), isStale: isStale(String(data.rate_date)) };
}
