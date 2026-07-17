import { describe, expect, it } from "vitest";
import {
  TradeRuleSchema,
  type TradeRule,
} from "@/schemas/rules/trade-rule-schema";
import { buildMonitoringQualityChecks } from "@/features/rules/services/trading-rule-validation";

describe("trade rule monitoring fields", () => {
  it("keeps old rule JSON compatible and applies monitoring defaults", () => {
    const result = TradeRuleSchema.parse({});

    expect(result.thesisBreakers).toEqual([]);
    expect(result.monitoring).toEqual({
      cooldownHours: 24,
      reviewCycle: "undecided",
    });
  });

  it("rejects more than ten thesis breakers", () => {
    const result = TradeRuleSchema.safeParse({
      thesisBreakers: Array.from({ length: 11 }, (_, index) => ({
        description: `condition-${index}`,
      })),
    });

    expect(result.success).toBe(false);
  });

  it("reports contradictory monitoring as a blocker", () => {
    const rule = TradeRuleSchema.parse({
      monitoring: { stopLossReviewPercent: 100 },
    });

    expect(buildMonitoringQualityChecks(rule)).toContainEqual(
      expect.objectContaining({
        checkKey: "contradictory_monitoring",
        status: "fail",
        severity: "high",
      }),
    );
  });

  it("warns when a thesis has no breaker or price threshold", () => {
    const rule = TradeRuleSchema.parse({
      investmentThesis: "私は事業の成長を観測する。",
    });

    const checks = buildMonitoringQualityChecks(rule);
    expect(checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ checkKey: "missing_thesis_breakers" }),
        expect.objectContaining({ checkKey: "missing_monitoring_threshold" }),
      ]),
    );
  });

  it("does not warn about missing breakers when they are set", () => {
    const rule: TradeRule = TradeRuleSchema.parse({
      investmentThesis: "私は事業の成長を観測する。",
      thesisBreakers: [{ description: "業績が2四半期連続で悪化する" }],
    });

    expect(buildMonitoringQualityChecks(rule)).not.toContainEqual(
      expect.objectContaining({ checkKey: "missing_thesis_breakers" }),
    );
  });
});
