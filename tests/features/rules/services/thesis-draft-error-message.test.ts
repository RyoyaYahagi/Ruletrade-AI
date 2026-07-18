import { describe, expect, it } from "vitest";
import { getThesisDraftStreamErrorNotice } from "@/features/rules/services/thesis-draft-error-message";

describe("getThesisDraftStreamErrorNotice", () => {
  it("shows a retry message for provider timeouts", () => {
    expect(getThesisDraftStreamErrorNotice("AI_PROVIDER_TIMEOUT")).toContain(
      "タイムアウト",
    );
  });

  it("shows a structured-output message separately", () => {
    expect(getThesisDraftStreamErrorNotice("AI_OUTPUT_INVALID")).toContain(
      "構造化形式",
    );
  });

  it("returns null for unknown stream errors", () => {
    expect(getThesisDraftStreamErrorNotice("UNKNOWN")).toBeNull();
  });
});
