import { describe, expect, it } from "vitest";
import { MockProvider } from "@/lib/ai/providers/mock-provider";
import { RuleReviewSchema } from "@/schemas/rules/rule-review-schema";

describe("MockProvider", () => {
  it("returns valid rule review object", async () => {
    const provider = new MockProvider();

    const result = await provider.generateObject({
      taskType: "rule_review",
      schema: RuleReviewSchema,
      schemaName: "RuleReview",
      promptVersion: "test-prompt",
      messages: [
        {
          role: "system",
          content: "test",
        },
        {
          role: "user",
          content: "test",
        },
      ],
    });

    expect(result.meta.provider).toBe("mock");
    expect(result.meta.promptVersion).toBe("test-prompt");
    expect(result.data.completionScore).toBeGreaterThanOrEqual(0);
    expect(result.data.completionScore).toBeLessThanOrEqual(100);
    expect(result.data.safety.passed).toBe(true);
    expect(result.usage.totalTokens).toBe(0);
  });
});
