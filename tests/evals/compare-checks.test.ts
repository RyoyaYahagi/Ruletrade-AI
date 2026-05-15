import { describe, expect, it } from "vitest";
import { compareExpectedChecks } from "@/lib/evals/compare-checks";

describe("compareExpectedChecks", () => {
  it("matches expected failed checks", () => {
    const result = compareExpectedChecks({
      review: {
        summary: "test",
        completionScore: 70,
        needsMoreInfo: true,
        canFinalize: false,
        qualityChecks: [
          {
            checkKey: "stop_loss_defined",
            label: "損切り条件",
            status: "fail",
            severity: "high",
            reason: "未設定です。",
          },
        ],
        nextQuestions: [],
        suggestedRuleUpdates: [],
        safety: {
          passed: true,
          riskLevel: "low",
          violations: [],
          prohibitedPhrasesDetected: [],
        },
      },
      expectedFailedChecks: ["stop_loss_defined"],
    });

    expect(result.matchedChecks).toEqual(["stop_loss_defined"]);
    expect(result.missingChecks).toEqual([]);
    expect(result.extraChecks).toEqual([]);
    expect(result.precision).toBe(1);
    expect(result.recall).toBe(1);
    expect(result.f1).toBe(1);
  });

  it("detects missing checks", () => {
    const result = compareExpectedChecks({
      review: {
        summary: "test",
        completionScore: 90,
        needsMoreInfo: false,
        canFinalize: true,
        qualityChecks: [],
        nextQuestions: [],
        suggestedRuleUpdates: [],
        safety: {
          passed: true,
          riskLevel: "low",
          violations: [],
          prohibitedPhrasesDetected: [],
        },
      },
      expectedFailedChecks: ["stop_loss_defined"],
    });

    expect(result.missingChecks).toEqual(["stop_loss_defined"]);
    expect(result.recall).toBe(0);
  });
});
