import { describe, expect, it } from "vitest";
import {
  parseStooqCsv,
  toStooqSymbol,
} from "@/lib/prices/providers/stooq-price-provider";

describe("StooqPriceProvider", () => {
  it("parses a normal CSV row", () => {
    const result = parseStooqCsv(
      "Symbol,Date,Time,Open,High,Low,Close,Volume\n7203.jp,2026-07-16,06:00:00,3000,3100,2950,3050,1000",
      { symbol: "7203", market: "JP" },
    );

    expect(result).toEqual({
      symbol: "7203",
      market: "JP",
      quoteDate: "2026-07-16",
      closePrice: 3050,
      currency: "JPY",
    });
  });

  it("skips N/D rows", () => {
    const result = parseStooqCsv(
      "Symbol,Date,Time,Open,High,Low,Close,Volume\n7203.jp,N/D,N/D,N/D,N/D,N/D,N/D,N/D",
      { symbol: "7203", market: "JP" },
    );

    expect(result).toBeNull();
  });

  it("converts symbols for JP, US, and FX markets", () => {
    expect(toStooqSymbol("7203", "JP")).toBe("7203.jp");
    expect(toStooqSymbol("AAPL", "US")).toBe("aapl.us");
    expect(toStooqSymbol("USDJPY", "FX")).toBe("usdjpy");
  });
});
