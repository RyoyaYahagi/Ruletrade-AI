import { describe, expect, it } from "vitest";
import { InvestorProfileSchema } from "@/schemas/rules/investor-profile-schema";

describe("InvestorProfileSchema", () => {
  it("applies safe MVP defaults", () => {
    const result = InvestorProfileSchema.safeParse({});

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      experienceLevel: "beginner",
      preferredQuestionStyle: "guided",
      profileJson: {},
    });
  });

  it("rejects unknown experience levels", () => {
    const result = InvestorProfileSchema.safeParse({
      experienceLevel: "expert",
    });

    expect(result.success).toBe(false);
  });

  it("rejects position percentages over 100", () => {
    const result = InvestorProfileSchema.safeParse({
      maxPositionPercent: 101,
    });

    expect(result.success).toBe(false);
  });

  it("rejects negative max loss percentages", () => {
    const result = InvestorProfileSchema.safeParse({
      maxLossPercent: -1,
    });

    expect(result.success).toBe(false);
  });
});
