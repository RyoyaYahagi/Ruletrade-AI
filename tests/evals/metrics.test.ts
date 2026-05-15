import { describe, expect, it } from "vitest";
import { calculatePrecisionRecallF1 } from "@/lib/evals/metrics";

describe("calculatePrecisionRecallF1", () => {
  it("calculates precision recall and f1", () => {
    const result = calculatePrecisionRecallF1({
      truePositive: 2,
      falsePositive: 1,
      falseNegative: 1,
    });

    expect(result.precision).toBeCloseTo(2 / 3);
    expect(result.recall).toBeCloseTo(2 / 3);
    expect(result.f1).toBeCloseTo(2 / 3);
  });

  it("handles zero denominator", () => {
    const result = calculatePrecisionRecallF1({
      truePositive: 0,
      falsePositive: 0,
      falseNegative: 0,
    });

    expect(result.precision).toBe(0);
    expect(result.recall).toBe(0);
    expect(result.f1).toBe(0);
  });
});
