import { describe, expect, it } from "vitest";
import { MockPriceProvider } from "@/lib/prices/providers/mock-price-provider";

describe("MockPriceProvider", () => {
  it("returns deterministic quotes for the same input", async () => {
    const symbols = [{ symbol: "7203", market: "JP" }];
    const first = await new MockPriceProvider({
      quoteDate: "2026-07-16",
    }).fetchDailyQuotes({ symbols });
    const second = await new MockPriceProvider({
      quoteDate: "2026-07-16",
    }).fetchDailyQuotes({ symbols });

    expect(first).toEqual(second);
    expect(first[0]).toMatchObject({
      symbol: "7203",
      market: "JP",
      quoteDate: "2026-07-16",
      currency: "JPY",
    });
  });
});
