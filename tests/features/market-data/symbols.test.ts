import { describe, expect, it } from "vitest";
import { toYahooSymbol } from "@/features/market-data/symbols";

describe("toYahooSymbol", () => {
  it.each([
    ["6758", "JP", "6758.T"],
    ["285A", "JP", "285A.T"],
    ["6758.T", "JP", "6758.T"],
    ["aapl", "US", "AAPL"],
    ["BRK.B", "US", "BRK.B"],
  ])("maps %s for market %s", (ticker, market, expected) => {
    expect(toYahooSymbol(ticker, market)).toBe(expected);
  });

  it.each([
    [null, "JP"],
    ["not a symbol", "US"],
    ["6758", "US"],
    ["AAPL", "JP"],
    ["UNKNOWN", null],
    ["285A.T.T", "JP"],
  ])("rejects unsupported mapping %s for market %s", (ticker, market) => {
    expect(toYahooSymbol(ticker, market)).toBeNull();
  });
});
