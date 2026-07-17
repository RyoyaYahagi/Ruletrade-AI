import { describe, expect, it } from "vitest";
import { MockFinancialsProvider } from "@/lib/financials/providers/mock-financials-provider";

describe("MockFinancialsProvider", () => {
  it("決定的な値を返し、取得できない項目はnullのままにする", async () => {
    const provider = new MockFinancialsProvider();
    const first = await provider.fetchNewStatements({
      tickers: ["7203"],
      sinceDate: "2026-07-01",
    });
    const second = await provider.fetchNewStatements({
      tickers: ["7203"],
      sinceDate: "2026-07-01",
    });

    expect(first).toEqual(second);
    expect(first[0]).toMatchObject({
      ticker: "7203",
      operatingIncome: null,
      equityRatio: null,
    });
    expect(first[0]?.operatingIncome).not.toBe(0);
  });
});
