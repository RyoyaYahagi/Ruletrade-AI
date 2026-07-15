import { describe, expect, it } from "vitest";
import {
  PortfolioCommonRuleSchema,
  PositionCheckRequestSchema,
} from "@/schemas/portfolio/portfolio-rule-schema";

describe("PortfolioCommonRuleSchema", () => {
  it("applies defaults for an empty rule", () => {
    const result = PortfolioCommonRuleSchema.safeParse({});

    expect(result.success).toBe(true);
    expect(result.data?.targetAllocations).toEqual([]);
    expect(result.data?.maxPositionPercent).toBeUndefined();
  });

  it("accepts a full common rule", () => {
    const result = PortfolioCommonRuleSchema.safeParse({
      maxPositionPercent: 10,
      maxSectorPercent: 25,
      maxThemePercent: 20,
      minCashPercent: 10,
      maxSingleTradeLossPercent: 2,
      targetAllocations: [
        { key: "stock", targetPercent: 80 },
        { key: "cash", targetPercent: 15, tolerancePercent: 3 },
      ],
      notes: "投機枠は5%まで",
    });

    expect(result.success).toBe(true);
    expect(result.data?.targetAllocations[0]?.tolerancePercent).toBe(5);
    expect(result.data?.targetAllocations[1]?.tolerancePercent).toBe(3);
  });

  it("rejects percentages over 100", () => {
    const result = PortfolioCommonRuleSchema.safeParse({
      maxPositionPercent: 101,
    });

    expect(result.success).toBe(false);
  });

  it("rejects negative percentages", () => {
    const result = PortfolioCommonRuleSchema.safeParse({
      minCashPercent: -1,
    });

    expect(result.success).toBe(false);
  });
});

describe("PositionCheckRequestSchema", () => {
  it("defaults fundedFromCash to true", () => {
    const result = PositionCheckRequestSchema.safeParse({
      ticker: "5803",
      marketValue: 100000,
    });

    expect(result.success).toBe(true);
    expect(result.data?.fundedFromCash).toBe(true);
  });

  it("rejects a missing ticker", () => {
    const result = PositionCheckRequestSchema.safeParse({
      marketValue: 100000,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a negative market value", () => {
    const result = PositionCheckRequestSchema.safeParse({
      ticker: "5803",
      marketValue: -1,
    });

    expect(result.success).toBe(false);
  });
});
