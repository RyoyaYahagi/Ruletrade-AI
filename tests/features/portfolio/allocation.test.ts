import { describe, expect, it } from "vitest";

import { getAllocationItems } from "@/features/portfolio/allocation";
import type { ValuationSummary } from "@/features/portfolio/valuation";

function composition(
  count: number,
): NonNullable<ValuationSummary["composition"]> {
  return Array.from({ length: count }, (_, index) => ({
    stockId: `stock-${index + 1}`,
    stockName: `銘柄${index + 1}`,
    marketValue: (count - index) * 100,
    percent: ((count - index) / ((count * (count + 1)) / 2)) * 100,
  }));
}

describe("getAllocationItems", () => {
  it("shows every holding when there are five or fewer", () => {
    const result = getAllocationItems(composition(5));

    expect(result).toHaveLength(5);
    expect(result?.map(({ stockName }) => stockName)).toEqual([
      "銘柄1",
      "銘柄2",
      "銘柄3",
      "銘柄4",
      "銘柄5",
    ]);
    expect(result?.reduce((sum, item) => sum + item.percent, 0)).toBeCloseTo(
      100,
    );
  });

  it("groups holdings after the top five into その他 and preserves 100 percent", () => {
    const result = getAllocationItems(composition(7));

    expect(result).toHaveLength(6);
    expect(result?.slice(0, 5).map(({ stockName }) => stockName)).toEqual([
      "銘柄1",
      "銘柄2",
      "銘柄3",
      "銘柄4",
      "銘柄5",
    ]);
    expect(result?.[5]).toMatchObject({
      stockName: "その他",
      marketValue: 300,
    });
    expect(result?.reduce((sum, item) => sum + item.percent, 0)).toBeCloseTo(
      100,
    );
  });

  it("does not create a chart view model when valuation is incomplete", () => {
    expect(getAllocationItems(null)).toBeNull();
  });
});
