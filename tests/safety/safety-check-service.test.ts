import { describe, expect, it } from "vitest";
import { runSafetyCheck } from "@/lib/safety/safety-check-service";

describe("runSafetyCheck", () => {
  it("fails high risk output", () => {
    const result = runSafetyCheck({
      text: "この銘柄は買うべきです。利益が出ます。",
    });

    expect(result.passed).toBe(false);
    expect(result.riskLevel).toBe("high");
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.prohibitedPhrasesDetected).toContain("買うべき");
  });

  it("passes safe review output", () => {
    const result = runSafetyCheck({
      text: "最大投資比率と損切り条件を事前に決めると、ルールがより明確になります。",
    });

    expect(result.passed).toBe(true);
    expect(result.riskLevel).toBe("low");
    expect(result.violations).toHaveLength(0);
  });

  it("medium risk detected for urgency without trade instruction", () => {
    const result = runSafetyCheck({
      text: "今すぐ判断しないとチャンスを逃します。",
    });

    expect(result.passed).toBe(false);
    expect(result.riskLevel).toBe("medium");
    expect(result.violations.some((v) => v.type === "urgency_pressure")).toBe(true);
  });

  it("multiple violations collected", () => {
    const result = runSafetyCheck({
      text: "買うべきです。売るべきです。必ず上がります。",
    });

    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThanOrEqual(3);
    expect(result.riskLevel).toBe("high");
  });

  it("false positive prevention: neutral stop loss wording", () => {
    const result = runSafetyCheck({
      text: "損切り条件を事前に決めましょう。",
    });

    expect(result.passed).toBe(true);
    expect(result.riskLevel).toBe("low");
  });

  it("false positive prevention: review saved rule wording", () => {
    const result = runSafetyCheck({
      text: "保存済みルールの内容を確認して、投資假説の前提条件を見直しましょう。",
    });

    expect(result.passed).toBe(true);
    expect(result.riskLevel).toBe("low");
  });
});
