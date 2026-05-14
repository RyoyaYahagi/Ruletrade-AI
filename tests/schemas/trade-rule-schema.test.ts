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

