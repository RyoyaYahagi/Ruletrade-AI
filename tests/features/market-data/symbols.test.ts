import { describe, expect, it } from "vitest";
import {
  parseConstantNavSymbol,
  parseFundSymbol,
  toFundSymbol,
  toQuoteSymbol,
  toYahooSymbol,
} from "@/features/market-data/symbols";

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

describe("fund symbols", () => {
  it("prefers the fund codes over the ticker", () => {
    const symbol = toQuoteSymbol({
      ticker: null,
      marketCode: "JP",
      fundIsin: "JP90C000GKC6",
      fundAssociationCode: "03311187",
    });
    expect(symbol).toBe("FUND:JP90C000GKC6:03311187");
    expect(parseFundSymbol(symbol!)).toEqual({
      isin: "JP90C000GKC6",
      associationCode: "03311187",
    });
  });

  it("falls back to the stock ticker when either fund code is missing", () => {
    expect(
      toQuoteSymbol({
        ticker: "7203",
        marketCode: "JP",
        fundIsin: "JP90C000GKC6",
      }),
    ).toBe("7203.T");
    expect(toFundSymbol("JP90C000GKC6", "short")).toBeNull();
    expect(parseFundSymbol("7203.T")).toBeNull();
  });
});

describe("constant NAV funds", () => {
  it("prices the USD MMF at its fixed 0.01 USD per unit", () => {
    const symbol = toQuoteSymbol({
      ticker: null,
      marketCode: "US",
      stockName:
        "ノーザン・トラスト・米ドル・リクイディティ・ファンド(楽天・米ドルMMF)",
    });
    expect(symbol).toBe("CONSTANT:USD:0.01");
    expect(parseConstantNavSymbol(symbol!)).toEqual({
      price: 0.01,
      currency: "USD",
    });
  });

  it("prefers registered fund codes and ignores unknown funds", () => {
    expect(
      toQuoteSymbol({
        ticker: null,
        marketCode: "JP",
        stockName: "楽天・マネーファンド",
        fundIsin: "JP90C000GKC6",
        fundAssociationCode: "03311187",
      }),
    ).toBe("FUND:JP90C000GKC6:03311187");
    expect(
      toQuoteSymbol({
        ticker: null,
        marketCode: "JP",
        stockName: "未知のファンド",
      }),
    ).toBeNull();
    expect(parseConstantNavSymbol("CONSTANT:USD:5")).toBeNull();
  });
});
