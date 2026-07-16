import type { DailyQuote, FxRate, PriceProvider } from "@/lib/prices/price-provider";

function deterministicPrice(symbol: string) {
  const score = [...symbol].reduce((sum, character) => sum + character.codePointAt(0)!, 0);
  return 1000 + (score % 9000);
}

export class MockPriceProvider implements PriceProvider {
  readonly name = "mock";

  async fetchDailyQuotes(params: { symbols: Array<{ symbol: string; market: string }> }): Promise<DailyQuote[]> {
    const quoteDate = new Date().toISOString().slice(0, 10);
    return params.symbols.map((item) => ({
      symbol: item.symbol,
      market: item.market,
      quoteDate,
      closePrice: deterministicPrice(item.symbol),
      currency: item.market === "US" ? "USD" : "JPY",
    }));
  }

  async fetchFxRates(params: { pairs: string[] }): Promise<FxRate[]> {
    const rateDate = new Date().toISOString().slice(0, 10);
    return params.pairs.map((pair) => ({ pair, rateDate, rate: pair === "USDJPY" ? 150 : 1 }));
  }
}

export { deterministicPrice };
