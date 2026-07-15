import { describe, expect, it } from "vitest";
import {
  PortfolioPositionImageImportSchema,
  PortfolioPositionImportItemSchema,
} from "@/schemas/portfolio/portfolio-position-import-schema";

describe("PortfolioPositionImageImportSchema", () => {
  it("accepts an investment trust without a ticker when its name is present", () => {
    const result = PortfolioPositionImportItemSchema.parse({
      companyName: "たわらノーロード 全世界株式",
      assetType: "fund",
      marketValue: "120,000",
      currency: "JPY",
      market: "JP",
    });

    expect(result.ticker).toBeUndefined();
    expect(result.marketValue).toBe(120000);
    expect(result.assetType).toBe("fund");
  });

  it("rejects a row with neither ticker nor name", () => {
    expect(() =>
      PortfolioPositionImportItemSchema.parse({
        assetType: "stock",
        marketValue: 1000,
      }),
    ).toThrow();
  });

  it("accepts multiple stock and fund rows", () => {
    const result = PortfolioPositionImageImportSchema.parse({
      positions: [
        { ticker: "7203", companyName: "トヨタ自動車", assetType: "stock", marketValue: 50000 },
        { companyName: "国内株式インデックス", assetType: "fund", marketValue: 30000 },
      ],
    });

    expect(result.positions).toHaveLength(2);
    expect(result.positions[1]?.assetType).toBe("fund");
  });
});
