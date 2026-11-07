import "server-only";

import { fundNavPriceProvider } from "@/features/market-data/fund-nav";
import {
  yahooMarketPriceProvider,
  type MarketPriceProvider,
} from "@/features/market-data/provider";
import { parseFundSymbol } from "@/features/market-data/symbols";

/** 投資信託は投資信託協会、それ以外は Yahoo Finance から引く */
export const marketPriceProvider: MarketPriceProvider = {
  async getQuotes(symbols) {
    const funds = symbols.filter((symbol) => parseFundSymbol(symbol));
    const others = symbols.filter((symbol) => !parseFundSymbol(symbol));
    const [fundQuotes, otherQuotes] = await Promise.all([
      fundNavPriceProvider.getQuotes(funds),
      yahooMarketPriceProvider.getQuotes(others),
    ]);
    return new Map([...otherQuotes, ...fundQuotes]);
  },
};
