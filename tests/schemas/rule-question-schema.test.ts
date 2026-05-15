import { describe, expect, it } from "vitest";
import { RuleQuestionSchema } from "@/schemas/rules/rule-question-schema";

const validQuestion = {
  questionKey: "stop_loss",
  questionText: "どの条件で損切りしますか？",
  questionType: "free_text",
};

describe("RuleQuestionSchema", () => {
  it("accepts a valid question and applies workflow defaults", () => {
    const result = RuleQuestionSchema.safeParse(validQuestion);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      priority: 1,
      isRequired: true,
      source: "ai",
      status: "pending",
      displayOrder: 0,
    });
  });

  it("rejects empty question keys", () => {
    const result = RuleQuestionSchema.safeParse({
      ...validQuestion,
      questionKey: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown question types", () => {
    const result = RuleQuestionSchema.safeParse({
      ...validQuestion,
      questionType: "slider",
    });

    expect(result.success).toBe(false);
  });

  it("rejects priorities outside 1 through 5", () => {
    const result = RuleQuestionSchema.safeParse({
      ...validQuestion,
      priority: 6,
    });

    expect(result.success).toBe(false);
  });
});

