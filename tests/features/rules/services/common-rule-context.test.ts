import { describe, expect, it } from "vitest";
import {
  buildCommonRuleContextText,
  filterQuestionsCoveredByCommonRule,
  getCoveredRuleFields,
} from "@/features/rules/services/common-rule-context";
import { PortfolioCommonRuleSchema } from "@/schemas/portfolio/portfolio-rule-schema";

function buildRule(input: Record<string, unknown>) {
  const parsed = PortfolioCommonRuleSchema.safeParse(input);
  if (!parsed.success) throw new Error("invalid rule fixture");
  return parsed.data;
}

describe("getCoveredRuleFields", () => {
  it("returns empty when no rule exists", () => {
    expect(getCoveredRuleFields(null)).toEqual([]);
  });

  it("covers position size fields when maxPositionPercent is set", () => {
    const covered = getCoveredRuleFields(buildRule({ maxPositionPercent: 10 }));

    expect(covered).toContain("riskManagement.maxPositionPercent");
    expect(covered).toContain("riskManagement.maxPositionAmount");
  });

  it("covers loss limit when maxSingleTradeLossPercent is set", () => {
    const covered = getCoveredRuleFields(
      buildRule({ maxSingleTradeLossPercent: 2 }),
    );

    expect(covered).toEqual(["riskManagement.maxLossPercent"]);
  });

  it("does not cover fields for unrelated limits", () => {
    const covered = getCoveredRuleFields(buildRule({ maxSectorPercent: 25 }));

    expect(covered).toEqual([]);
  });
});

describe("filterQuestionsCoveredByCommonRule", () => {
  const questions = [
    { questionKey: "q1", mapsToRuleField: "riskManagement.maxPositionPercent" },
    { questionKey: "q2", mapsToRuleField: "exitPlan.exitConditions" },
    { questionKey: "q3", mapsToRuleField: undefined },
  ];

  it("drops questions whose field is covered by the common rule", () => {
    const filtered = filterQuestionsCoveredByCommonRule(questions, [
      "riskManagement.maxPositionPercent",
    ]);

    expect(filtered.map((q) => q.questionKey)).toEqual(["q2", "q3"]);
  });

  it("keeps everything when nothing is covered", () => {
    const filtered = filterQuestionsCoveredByCommonRule(questions, []);

    expect(filtered).toHaveLength(3);
  });
});

describe("buildCommonRuleContextText", () => {
  it("returns null when no rule exists", () => {
    expect(buildCommonRuleContextText(null)).toBeNull();
  });

  it("returns null when the rule has no configured values", () => {
    expect(buildCommonRuleContextText(buildRule({}))).toBeNull();
  });

  it("lists configured limits and target allocations", () => {
    const text = buildCommonRuleContextText(
      buildRule({
        maxPositionPercent: 10,
        minCashPercent: 15,
        targetAllocations: [{ key: "stock", targetPercent: 80 }],
      }),
    );

    expect(text).toContain("1銘柄の最大比率: 10%");
    expect(text).toContain("現金比率の下限: 15%");
    expect(text).toContain("目標配分 stock: 80%");
  });
});
