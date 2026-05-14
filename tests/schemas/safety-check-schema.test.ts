import { describe, expect, it } from "vitest";
import { SafetyCheckSchema } from "@/schemas/safety/safety-check-schema";

describe("SafetyCheckSchema", () => {
  it("accepts boolean pass status and applies array defaults", () => {
    const result = SafetyCheckSchema.safeParse({
      passed: true,
      riskLevel: "low",
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      violations: [],
      prohibitedPhrasesDetected: [],
    });
  });

  it("rejects unknown risk levels", () => {
    const result = SafetyCheckSchema.safeParse({
      passed: true,
      riskLevel: "critical",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown violation types", () => {
    const result = SafetyCheckSchema.safeParse({
      passed: false,
      riskLevel: "high",
      violations: [
        {
          type: "guaranteed_win",
          reason: "Unsupported safety category.",
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});

