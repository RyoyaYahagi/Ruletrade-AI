import { describe, expect, it } from "vitest";
import { hashValue, redactRuleTrace } from "@/features/rules/services/rule-ai-trace-service";

describe("rule-ai-trace-service", () => {
  it("masks private values and secrets while preserving structure", () => {
    const result = redactRuleTrace(
      {
        answer: "JX金属の成長を確認する",
        contact: "person@example.com",
        token: "Bearer abc123",
      },
      ["JX金属"],
    );

    expect(result).toEqual({
      answer: "[PRIVATE_REDACTED]の成長を確認する",
      contact: "[EMAIL_REDACTED]",
      token: "Bearer [TOKEN_REDACTED]",
    });
  });

  it("returns stable hashes regardless of object key order", () => {
    expect(hashValue({ b: 2, a: 1 })).toBe(hashValue({ a: 1, b: 2 }));
  });
});
