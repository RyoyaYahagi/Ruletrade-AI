import "server-only";

import { createDatabaseClient } from "@/lib/db/database-client";
import { createPriceProvider } from "@/lib/prices/price-provider-factory";
import {
  getLatestFxRate,
  saveDailyQuotes,
  saveFxRates,
} from "@/lib/prices/price-quote-service";

export async function refreshDailyPrices() {
  const db = await createDatabaseClient();
  const [positionsResult, watchlistResult] = await Promise.all([
    db.from("portfolio_positions").select("ticker, market").neq("position_status", "archived").limit(5000),
    db.from("watchlist_items").select("ticker, market").neq("status", "archived").limit(5000),
  ]);
  if (positionsResult.error || watchlistResult.error) throw positionsResult.error ?? watchlistResult.error;

  const symbols = new Map<string, { symbol: string; market: string }>();
  for (const row of [...(positionsResult.data ?? []), ...(watchlistResult.data ?? [])]) {
    const symbol = String(row.ticker ?? "").trim();
    if (!symbol) continue;
    const market = String(row.market ?? "JP");
    symbols.set(`${market}:${symbol}`, { symbol, market });
  }

  const provider = createPriceProvider();
  const requestedSymbols = [...symbols.values()];
  const quotes = await provider.fetchDailyQuotes({ symbols: requestedSymbols });
  const { savedCount } = await saveDailyQuotes(quotes, { source: provider.name });
  const requestedCurrencies = new Set<string>(
    requestedSymbols.flatMap((item) => (item.market === "US" ? ["USDJPY"] : [])),
  );
  const fxRates = requestedCurrencies.size
    ? await provider.fetchFxRates({ pairs: [...requestedCurrencies] })
    : [];
  const { savedCount: savedFxCount } = await saveFxRates(fxRates, { source: provider.name });

  await updatePositionSnapshots();

  const returnedKeys = new Set(quotes.map((quote) => `${quote.market}:${quote.symbol}`));
  return {
    requestedCount: requestedSymbols.length,
    savedCount,
    savedFxCount,
    failedSymbols: requestedSymbols
      .filter((item) => !returnedKeys.has(`${item.market}:${item.symbol}`))
      .map((item) => item.symbol),
    provider: provider.name,
  };
}

async function updatePositionSnapshots() {
  const db = await createDatabaseClient();
  const { data: positions, error } = await db
    .from("portfolio_positions")
    .select("id, user_id, ticker, market, currency, quantity")
    .neq("position_status", "archived")
    .limit(5000);
  if (error) throw error;

  const fx = await getLatestFxRate("USDJPY");
  for (const position of positions ?? []) {
    const market = String(position.market ?? "JP");
    const symbol = String(position.ticker);
    const quote = await db
      .from("price_quotes")
      .select("close_price, quote_date, currency")
      .eq("symbol", symbol)
      .eq("market", market)
      .order("quote_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (quote.error || !quote.data) continue;

    const closePrice = Number(quote.data.close_price);
    const quantity = Number(position.quantity);
    const update: Record<string, unknown> = {
      current_price: closePrice,
      price_updated_at: `${quote.data.quote_date}T00:00:00.000Z`,
    };
    if (Number.isFinite(quantity) && quantity > 0) {
      const isUsd = String(position.currency) === "USD";
      const conversionRate = isUsd ? fx.rate : 1;
      if (conversionRate !== null && (!isUsd || !fx.isStale)) {
        update.market_value = closePrice * quantity * conversionRate;
      }
    }

    const { error: updateError } = await db
      .from("portfolio_positions")
      .update(update)
      .eq("id", position.id)
      .eq("user_id", position.user_id);
    if (updateError) throw updateError;
  }
}
