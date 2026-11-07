import "server-only";

import { yahooMarketPriceProvider } from "@/features/market-data/provider";

export type ExchangeRate = {
  rate: number;
  priceAt: string | null;
  sourceName: string | null;
};

// Yahoo Finance's JPY=X is the number of JPY per 1 USD.
export const USD_JPY_SYMBOL = "JPY=X";

export async function getUsdJpyRate(): Promise<ExchangeRate | null> {
  try {
    const quotes = await yahooMarketPriceProvider.getQuotes([USD_JPY_SYMBOL]);
    const quote = quotes.get(USD_JPY_SYMBOL);
    if (
      !quote ||
      quote.currency !== "JPY" ||
      !Number.isFinite(quote.price) ||
      quote.price <= 0
    ) {
      return null;
    }
    return {
      rate: quote.price,
      priceAt: quote.priceAt,
      sourceName: quote.sourceName,
    };
  } catch {
    return null;
  }
}
