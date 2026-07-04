import { describe, expect, it } from "vitest";
import { RuleReviewSchema } from "@/schemas/rules/rule-review-schema";

const validReview = {
  summary: "損切り条件が未設定です。",
  completionScore: 70,
  needsMoreInfo: true,
  canFinalize: false,
  qualityChecks: [
    {
      checkKey: "stop_loss_defined",
      label: "損切り条件",
      status: "fail",
      severity: "high",
      reason: "損切り条件がまだ決まっていません。",
      suggestedQuestion: "どの条件で見直しますか？",
    },
  ],
  nextQuestions: [],
  suggestedRuleUpdates: [],
  safety: {
    passed: true,
    riskLevel: "low",
    violations: [],
    prohibitedPhrasesDetected: [],
  },
};

describe("RuleReviewSchema", () => {
  it("accepts valid rule review output", () => {
    const result = RuleReviewSchema.safeParse(validReview);

    expect(result.success).toBe(true);
  });

  it("accepts completionScore boundaries", () => {
    expect(
      RuleReviewSchema.safeParse({
        ...validReview,
        completionScore: 0,
      }).success,
    ).toBe(true);
    expect(
      RuleReviewSchema.safeParse({
        ...validReview,
        completionScore: 100,
      }).success,
    ).toBe(true);
  });

  it("accepts choice-based next questions", () => {
    const result = RuleReviewSchema.safeParse({
      ...validReview,
      nextQuestions: [
        {
          questionKey: "entry_condition",
          questionText: "どの条件なら買い増しを検討しますか？",
          questionType: "single_choice",
          options: [
            { value: "discount", label: "割安感が出たら" },
            { value: "undecided", label: "まだ決めていない" },
            { value: "ask_ai", label: "候補を提案してほしい" },
          ],
          priority: 1,
          isRequired: true,
          source: "ai",
          status: "pending",
          displayOrder: 0,
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects completionScore over 100", () => {
    const result = RuleReviewSchema.safeParse({
      ...validReview,
      completionScore: 101,
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown quality check statuses", () => {
    const result = RuleReviewSchema.safeParse({
      ...validReview,
      qualityChecks: [
        {
          ...validReview.qualityChecks[0],
          status: "blocked",
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects reviews without safety output", () => {
    const reviewWithoutSafety: Record<string, unknown> = { ...validReview };
    delete reviewWithoutSafety.safety;
    const result = RuleReviewSchema.safeParse(reviewWithoutSafety);

    expect(result.success).toBe(false);
  });

  it("rejects empty summaries", () => {
    const result = RuleReviewSchema.safeParse({
      ...validReview,
      summary: "",
    });

    expect(result.success).toBe(false);
  });
});
