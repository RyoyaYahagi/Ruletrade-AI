import { describe, expect, it } from "vitest";
import { MockPriceProvider } from "@/lib/prices/providers/mock-price-provider";
import { parseStooqCsv } from "@/lib/prices/providers/stooq-price-provider";

describe("price providers", () => {
  it("returns deterministic mock prices for the same symbols", async () => {
    const provider = new MockPriceProvider();
    const symbols = [{ symbol: "7203", market: "JP" }];
    await expect(provider.fetchDailyQuotes({ symbols })).resolves.toEqual(
      await provider.fetchDailyQuotes({ symbols }),
    );
  });

  it("parses a Stooq CSV close price", () => {
    expect(
      parseStooqCsv({
        symbol: "7203",
        market: "JP",
        csv: "Symbol,Date,Time,Open,High,Low,Close,Volume\n7203.jp,2026-07-16,16:00,3000,3100,2950,3050,1000",
      }),
    ).toMatchObject({ symbol: "7203", quoteDate: "2026-07-16", closePrice: 3050 });
  });

  it("skips a Stooq N/D row", () => {
    expect(
      parseStooqCsv({
        symbol: "UNKNOWN",
        market: "JP",
        csv: "Symbol,Date,Time,Open,High,Low,Close,Volume\nUNKNOWN.jp,N/D,N/D,N/D,N/D,N/D,N/D,N/D",
      }),
    ).toBeNull();
  });
});
