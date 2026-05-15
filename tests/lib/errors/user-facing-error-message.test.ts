import { describe, expect, it } from "vitest";
import { getUserFacingErrorMessage } from "@/lib/errors/user-facing-error-message";

describe("getUserFacingErrorMessage", () => {
  it("returns safe message for RATE_LIMITED", () => {
    const msg = getUserFacingErrorMessage("RATE_LIMITED");
    expect(msg).toContain("短時間に");
  });

  it("returns safe message for COST_LIMIT_EXCEEDED", () => {
    const msg = getUserFacingErrorMessage("COST_LIMIT_EXCEEDED");
    expect(msg).toContain("上限に達");
  });

  it("returns fallback for unknown code", () => {
    const msg = getUserFacingErrorMessage("INTERNAL_ERROR");
    expect(msg).toContain("予期しない");
  });
});
