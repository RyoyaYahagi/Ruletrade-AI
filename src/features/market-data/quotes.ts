import "server-only";

import { fundNavPriceProvider } from "@/features/market-data/fund-nav";
import {
  yahooMarketPriceProvider,
  type MarketPriceProvider,
  type MarketQuote,
} from "@/features/market-data/provider";
import {
  parseConstantNavSymbol,
  parseFundSymbol,
} from "@/features/market-data/symbols";

/** 投資信託は投資信託協会、基準価額が固定の投資信託は固定の単価、それ以外は Yahoo Finance から引く */
export const marketPriceProvider: MarketPriceProvider = {
  async getQuotes(symbols) {
    const funds = symbols.filter((symbol) => parseFundSymbol(symbol));
    const others = symbols.filter(
      (symbol) => !parseFundSymbol(symbol) && !parseConstantNavSymbol(symbol),
    );
    const constantQuotes = new Map<string, MarketQuote>();
    for (const symbol of symbols) {
      const fund = parseConstantNavSymbol(symbol);
      if (!fund) continue;
      constantQuotes.set(symbol, {
        symbol,
        price: fund.price,
        currency: fund.currency,
        priceAt: null,
        marketState: null,
        delayedByMinutes: null,
        sourceName: "固定の基準価額",
      });
    }
    const [fundQuotes, otherQuotes] = await Promise.all([
      fundNavPriceProvider.getQuotes(funds),
      yahooMarketPriceProvider.getQuotes(others),
    ]);
    return new Map([...otherQuotes, ...fundQuotes, ...constantQuotes]);
  },
};
