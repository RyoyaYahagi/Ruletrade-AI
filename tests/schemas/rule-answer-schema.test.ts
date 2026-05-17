import { describe, expect, it } from "vitest";
import { RuleAnswerSchema } from "@/schemas/rules/rule-answer-schema";

describe("RuleAnswerSchema", () => {
  it("accepts supported answer JSON shapes", () => {
    const examples = [
      { value: "yes", label: "はい" },
      { values: ["growth", "quality"] },
      { min: 1000, max: 1500, currency: "JPY" },
      { value: 123 },
      { text: "決算前に見直します。" },
      { custom: true },
    ];

    for (const answerJson of examples) {
      const result = RuleAnswerSchema.safeParse({
        questionKey: "entry_condition",
        answerJson,
      });

      expect(result.success).toBe(true);
    }
  });

  it("rejects empty question keys", () => {
    const result = RuleAnswerSchema.safeParse({
      questionKey: "",
      answerJson: { text: "test" },
    });

    expect(result.success).toBe(false);
  });

  it("rejects overly long answer text", () => {
    const result = RuleAnswerSchema.safeParse({
      questionKey: "entry_condition",
      answerText: "a".repeat(4001),
    });

    expect(result.success).toBe(false);
  });
});
