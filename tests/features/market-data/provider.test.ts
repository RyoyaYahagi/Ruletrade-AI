import { beforeEach, describe, expect, it, vi } from "vitest";

const { quote } = vi.hoisted(() => ({ quote: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("yahoo-finance2", () => ({
  default: class YahooFinanceMock {
    quote = quote;
  },
}));

import { yahooMarketPriceProvider } from "@/features/market-data/provider";

function yahooQuote(symbol: string, overrides: Record<string, unknown> = {}) {
  return {
    symbol,
    regularMarketPrice: 123.45,
    currency: "USD",
    regularMarketTime: new Date("2026-09-28T00:00:00.000Z"),
    marketState: "REGULAR",
    exchangeDataDelayedBy: 15,
    quoteSourceName: "Nasdaq Real Time Price",
    ...overrides,
  };
}

beforeEach(() => {
  quote.mockReset();
  delete process.env.RULETRADE_E2E_DISABLE_MARKET_QUOTES;
});

describe("yahooMarketPriceProvider", () => {
  it("deduplicates symbols and converts valid quotes", async () => {
    quote.mockResolvedValue(new Map([["AAPL", yahooQuote("AAPL")]]));

    const result = await yahooMarketPriceProvider.getQuotes(["AAPL", "AAPL"]);

    expect(quote).toHaveBeenCalledTimes(1);
    expect(quote).toHaveBeenCalledWith(["AAPL"], { return: "map" });
    expect(result.get("AAPL")).toEqual({
      symbol: "AAPL",
      price: 123.45,
      currency: "USD",
      priceAt: "2026-09-28T00:00:00.000Z",
      marketState: "REGULAR",
      delayedByMinutes: 15,
      sourceName: "Nasdaq Real Time Price",
    });
  });

  it("leaves missing and invalid symbol quotes unavailable", async () => {
    quote.mockResolvedValue(
      new Map([
        ["GOOD", yahooQuote("GOOD")],
        ["BAD_PRICE", yahooQuote("BAD_PRICE", { regularMarketPrice: NaN })],
        ["BAD_CURRENCY", yahooQuote("BAD_CURRENCY", { currency: "EUR" })],
      ]),
    );

    const result = await yahooMarketPriceProvider.getQuotes([
      "GOOD",
      "BAD_PRICE",
      "BAD_CURRENCY",
      "MISSING",
    ]);

    expect([...result.keys()]).toEqual(["GOOD"]);
  });

  it("returns partial results when the provider rejects", async () => {
    quote.mockRejectedValue(new Error("provider unavailable"));

    await expect(yahooMarketPriceProvider.getQuotes(["FAIL"])).resolves.toEqual(
      new Map(),
    );
  });

  it("preserves a valid price when optional quote metadata is missing", async () => {
    quote.mockResolvedValue(
      new Map([
        [
          "2800.T",
          yahooQuote("2800.T", {
            currency: "JPY",
            regularMarketTime: undefined,
            marketState: undefined,
            exchangeDataDelayedBy: undefined,
            quoteSourceName: undefined,
          }),
        ],
      ]),
    );

    const result = await yahooMarketPriceProvider.getQuotes(["2800.T"]);

    expect(result.get("2800.T")).toMatchObject({
      price: 123.45,
      currency: "JPY",
      priceAt: null,
      marketState: null,
      delayedByMinutes: null,
      sourceName: null,
    });
  });

  it("caches valid quotes for five minutes", async () => {
    quote.mockResolvedValue(
      new Map([["CACHE_TEST", yahooQuote("CACHE_TEST")]]),
    );

    await yahooMarketPriceProvider.getQuotes(["CACHE_TEST"]);
    await yahooMarketPriceProvider.getQuotes(["CACHE_TEST"]);

    expect(quote).toHaveBeenCalledTimes(1);
  });

  it("caches unavailable quotes so repeated page loads do not retry immediately", async () => {
    quote.mockResolvedValue(new Map());

    await yahooMarketPriceProvider.getQuotes(["UNAVAILABLE_TEST"]);
    await yahooMarketPriceProvider.getQuotes(["UNAVAILABLE_TEST"]);

    expect(quote).toHaveBeenCalledTimes(1);
  });

  it("shares an in-flight request between concurrent calls", async () => {
    let resolveBatch!: (
      quotes: Map<string, ReturnType<typeof yahooQuote>>,
    ) => void;
    quote.mockReturnValue(
      new Promise((resolve) => {
        resolveBatch = resolve;
      }),
    );

    const first = yahooMarketPriceProvider.getQuotes(["CONCURRENT_TEST"]);
    const second = yahooMarketPriceProvider.getQuotes(["CONCURRENT_TEST"]);
    resolveBatch(new Map([["CONCURRENT_TEST", yahooQuote("CONCURRENT_TEST")]]));

    await expect(Promise.all([first, second])).resolves.toEqual([
      new Map([
        [
          "CONCURRENT_TEST",
          expect.objectContaining({ symbol: "CONCURRENT_TEST" }),
        ],
      ]),
      new Map([
        [
          "CONCURRENT_TEST",
          expect.objectContaining({ symbol: "CONCURRENT_TEST" }),
        ],
      ]),
    ]);
    expect(quote).toHaveBeenCalledTimes(1);
  });

  it("retries quotes individually when a batch request rejects", async () => {
    quote.mockImplementation((symbols: string | string[]) => {
      if (Array.isArray(symbols)) {
        return Promise.reject(new Error("batch rejected"));
      }
      if (symbols === "ONE_FAILED") {
        return Promise.reject(new Error("symbol unavailable"));
      }
      return Promise.resolve(yahooQuote(symbols));
    });

    const result = await yahooMarketPriceProvider.getQuotes([
      "ONE_SURVIVES",
      "ONE_FAILED",
    ]);

    expect([...result.keys()]).toEqual(["ONE_SURVIVES"]);
  });

  it("does not call Yahoo Finance during end-to-end tests", async () => {
    process.env.RULETRADE_E2E_DISABLE_MARKET_QUOTES = "1";

    await expect(yahooMarketPriceProvider.getQuotes(["AAPL"])).resolves.toEqual(
      new Map(),
    );
    expect(quote).not.toHaveBeenCalled();
  });
});
