import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prices/price-quote-service", () => ({
  getLatestQuotes: vi.fn(),
  quoteMapKey: (symbol: string, market: string) => `${market}:${symbol}`,
}));

import { getLatestQuotes } from "@/lib/prices/price-quote-service";
import { applyLatestQuotesToPositions } from "@/features/portfolio/services/portfolio-aggregation-service";

describe("applyLatestQuotesToPositions", () => {
  it("uses an automatic quote and recalculates value when quantity exists", async () => {
    vi.mocked(getLatestQuotes).mockResolvedValue(
      new Map([
        [
          "JP:7203",
          {
            quote: {
              symbol: "7203",
              market: "JP",
              quoteDate: "2026-07-16",
              closePrice: 3050,
              currency: "JPY",
            },
            isStale: false,
          },
        ],
      ]),
    );

    const [position] = await applyLatestQuotesToPositions({
      positions: [
        {
          ticker: "7203",
          market: "JP",
          quantity: 10,
          current_price: 2800,
          market_value: 28000,
        },
      ],
    });

    expect(position).toMatchObject({
      current_price: 3050,
      market_value: 30500,
      priceSource: "auto",
      priceAsOf: "2026-07-16",
      isStale: false,
    });
  });

  it("uses the manual value when no automatic quote exists", async () => {
    vi.mocked(getLatestQuotes).mockResolvedValue(new Map());

    const [position] = await applyLatestQuotesToPositions({
      positions: [
        {
          ticker: "MISSING",
          market: "JP",
          quantity: 10,
          current_price: 100,
          market_value: 1000,
        },
      ],
    });

    expect(position).toMatchObject({
      current_price: 100,
      market_value: 1000,
      priceSource: "manual",
      priceAsOf: null,
      isStale: false,
    });
  });
});
