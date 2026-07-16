import { apiSuccess } from "@/lib/api/api-response";
import { toErrorResponse } from "@/lib/errors/to-error-response";
import { createDatabaseClient } from "@/lib/db/database-client";
import { assertValidCronRequest } from "@/features/notifications/services/cron-auth-service";
import { createPriceProvider } from "@/lib/prices/price-provider-factory";
import { MAX_SYMBOLS_PER_RUN } from "@/lib/prices/providers/stooq-price-provider";
import {
  quoteMapKey,
  saveDailyQuotes,
  saveFxRates,
} from "@/lib/prices/price-quote-service";

type PriceSymbol = { symbol: string; market: string };

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();

  try {
    assertValidCronRequest(request);
    const db = await createDatabaseClient();
    const allSymbols = await collectPriceSymbols(db);
    const symbols = allSymbols.slice(0, MAX_SYMBOLS_PER_RUN);
    const provider = createPriceProvider();
    const quotes = await provider.fetchDailyQuotes({ symbols });
    const quoteSaveResult = await saveDailyQuotes(quotes);
    const fxRates = await provider.fetchFxRates({ pairs: ["USDJPY"] });
    const fxSaveResult = await saveFxRates(fxRates);

    const quoteKeys = new Set(
      quotes.map((quote) => quoteMapKey(quote.symbol, quote.market)),
    );
    const failedSymbols = [
      ...symbols
        .filter(
          (symbol) => !quoteKeys.has(quoteMapKey(symbol.symbol, symbol.market)),
        )
        .map((symbol) => symbol.symbol),
      ...allSymbols.slice(MAX_SYMBOLS_PER_RUN).map((symbol) => symbol.symbol),
    ];

    return apiSuccess({
      requestedCount: allSymbols.length,
      savedCount: quoteSaveResult.savedCount,
      fxSavedCount: fxSaveResult.savedCount,
      failedSymbols: Array.from(new Set(failedSymbols)),
    });
  } catch (error) {
    return toErrorResponse(error, {
      requestId,
      route: "/api/cron/prices/daily",
      method: "GET",
    });
  }
}

async function collectPriceSymbols(
  db: Awaited<ReturnType<typeof createDatabaseClient>>,
) {
  const [positionsResult, watchlistResult] = await Promise.all([
    db
      .from("portfolio_positions")
      .select("ticker, market")
      .neq("position_status", "archived")
      .limit(5000),
    db
      .from("watchlist_items")
      .select("ticker, market")
      .neq("status", "archived")
      .limit(5000),
  ]);

  if (positionsResult.error) throw positionsResult.error;
  if (watchlistResult.error) throw watchlistResult.error;

  const symbols = new Map<string, PriceSymbol>();
  for (const row of [
    ...(positionsResult.data ?? []),
    ...(watchlistResult.data ?? []),
  ]) {
    if (typeof row.ticker !== "string" || typeof row.market !== "string") {
      continue;
    }
    const symbol = row.ticker.trim();
    const market = row.market.trim();
    if (!symbol || !market) continue;
    symbols.set(quoteMapKey(symbol, market), { symbol, market });
  }

  return Array.from(symbols.values());
}
