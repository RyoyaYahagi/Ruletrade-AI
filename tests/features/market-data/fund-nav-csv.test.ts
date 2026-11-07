import { describe, expect, it } from "vitest";

import { parseFundNavCsv } from "@/features/market-data/fund-nav-csv";

describe("parseFundNavCsv", () => {
  it("reads the latest NAV per unit from the association CSV", () => {
    const csv = [
      "年月日,基準価額(円),純資産総額（百万円）,分配金,決算期",
      "2026年11月05日,44827,13201291,,",
      "2026年11月06日,42755,12599702,,",
      "",
    ].join("\r\n");
    expect(parseFundNavCsv(csv)).toEqual({
      price: 4.2755,
      priceAt: "2026-11-06T06:00:00.000Z",
    });
  });

  it("returns null for an error body or a header-only file", () => {
    expect(parseFundNavCsv('{"statusCode":null}')).toBeNull();
    expect(
      parseFundNavCsv(
        "年月日,基準価額(円),純資産総額（百万円）,分配金,決算期\n",
      ),
    ).toBeNull();
  });
});
