import { describe, expect, it } from "vitest";

import { UpdateAiUsageSettingsSchema } from "@/schemas/ai/ai-usage-schema";

describe("UpdateAiUsageSettingsSchema", () => {
  it("accepts limits from 0.1 USD through 10 USD", () => {
    expect(
      UpdateAiUsageSettingsSchema.safeParse({ monthlyLimitUsd: 0.1 }).success,
    ).toBe(true);
    expect(
      UpdateAiUsageSettingsSchema.safeParse({ monthlyLimitUsd: 10 }).success,
    ).toBe(true);
  });

  it("rejects limits outside the supported range", () => {
    expect(
      UpdateAiUsageSettingsSchema.safeParse({ monthlyLimitUsd: 0.09 }).success,
    ).toBe(false);
    expect(
      UpdateAiUsageSettingsSchema.safeParse({ monthlyLimitUsd: 10.01 }).success,
    ).toBe(false);
  });
});
