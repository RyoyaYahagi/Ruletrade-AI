import "server-only";

export type DailyQuote = {
  symbol: string;
  market: string;
  quoteDate: string;
  closePrice: number;
  currency: string;
};

export type FxRate = {
  pair: string;
  rateDate: string;
  rate: number;
};

export interface PriceProvider {
  readonly name: string;
  fetchDailyQuotes(params: {
    symbols: Array<{ symbol: string; market: string }>;
  }): Promise<DailyQuote[]>;
  fetchFxRates(params: { pairs: string[] }): Promise<FxRate[]>;
}
