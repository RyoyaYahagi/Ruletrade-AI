import { describe, expect, it } from "vitest";
import { TradeRuleSchema } from "@/schemas/rules/trade-rule-schema";

describe("TradeRuleSchema", () => {
  it("applies empty structured plan defaults", () => {
    const result = TradeRuleSchema.safeParse({});

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      entryPlan: {
        currency: "JPY",
        entryConditions: [],
      },
      riskManagement: {
        riskNotes: [],
      },
      exitPlan: {
        exitConditions: [],
      },
      earningsPolicy: {
        policy: "undecided",
      },
    });
  });

  it("defaults purpose to undecided and exitTriggers to empty", () => {
    const result = TradeRuleSchema.safeParse({});

    expect(result.success).toBe(true);
    expect(result.data?.purpose).toBe("undecided");
    expect(result.data?.exitTriggers).toEqual([]);
  });

  it("accepts a holding purpose and structured exit triggers", () => {
    const result = TradeRuleSchema.safeParse({
      purpose: "long_term_growth",
      exitTriggers: [
        { category: "price", condition: "購入価格から-8%", action: "review" },
        { category: "fundamental", condition: "通期予想の下方修正" },
        { category: "time", condition: "6か月経過してもシナリオが進まない" },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.data?.exitTriggers).toHaveLength(3);
    expect(result.data?.exitTriggers[1]?.action).toBe("review");
  });

  it("rejects an unknown exit trigger category", () => {
    const result = TradeRuleSchema.safeParse({
      exitTriggers: [{ category: "news", condition: "悪材料" }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects an unknown holding purpose", () => {
    const result = TradeRuleSchema.safeParse({
      purpose: "gamble",
    });

    expect(result.success).toBe(false);
  });

  it("rejects negative target prices", () => {
    const result = TradeRuleSchema.safeParse({
      entryPlan: {
        targetPriceMin: -1,
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects zero tranches", () => {
    const result = TradeRuleSchema.safeParse({
      entryPlan: {
        tranches: 0,
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects non-positive target multiples", () => {
    const result = TradeRuleSchema.safeParse({
      exitPlan: {
        targetMultiple: 0,
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects overly long free notes", () => {
    const result = TradeRuleSchema.safeParse({
      freeNotes: "a".repeat(4001),
    });

    expect(result.success).toBe(false);
  });
});
