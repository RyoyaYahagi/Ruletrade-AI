import "server-only";

import type {
  DailyQuote,
  FxRate,
  PriceProvider,
} from "@/lib/prices/price-provider";

type MockPriceProviderOptions = {
  quoteDate?: string;
  fxRateDate?: string;
};

export class MockPriceProvider implements PriceProvider {
  readonly name = "mock";

  private readonly quoteDate: string;
  private readonly fxRateDate: string;

  constructor(options: MockPriceProviderOptions = {}) {
    const today = new Date().toISOString().slice(0, 10);
    this.quoteDate = options.quoteDate ?? today;
    this.fxRateDate = options.fxRateDate ?? today;
  }

  async fetchDailyQuotes(params: {
    symbols: Array<{ symbol: string; market: string }>;
  }): Promise<DailyQuote[]> {
    return params.symbols.map(({ symbol, market }) => ({
      symbol,
      market,
      quoteDate: this.quoteDate,
      closePrice: deterministicNumber(`${market}:${symbol}`, 100, 10000),
      currency: market === "US" ? "USD" : "JPY",
    }));
  }

  async fetchFxRates(params: { pairs: string[] }): Promise<FxRate[]> {
    return params.pairs.map((pair) => ({
      pair,
      rateDate: this.fxRateDate,
      rate: deterministicNumber(pair, 100, 200),
    }));
  }
}

function deterministicNumber(seed: string, min: number, max: number) {
  let hash = 0;
  for (const character of seed) {
    hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  }
  return min + (hash % (max - min + 1));
}
