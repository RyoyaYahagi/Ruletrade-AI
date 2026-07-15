import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MockProvider } from "@/lib/ai/providers/mock-provider";
import { AIProviderError } from "@/lib/ai/ai-provider-error";
import { PortfolioRuleGuidanceResponseSchema } from "@/schemas/portfolio/portfolio-rule-guidance-schema";

describe("MockProvider", () => {
  const provider = new MockProvider();

  describe("generateObject", () => {
    it("RuleReview schemaName で正常に返却する", async () => {
      const schema = z.object({
        summary: z.string(),
        completionScore: z.number(),
        needsMoreInfo: z.boolean(),
        canFinalize: z.boolean(),
        qualityChecks: z.array(z.unknown()),
        nextQuestions: z.array(z.unknown()),
        suggestedRuleUpdates: z.array(z.unknown()),
        safety: z.object({
          passed: z.boolean(),
          riskLevel: z.string(),
          violations: z.array(z.unknown()),
          prohibitedPhrasesDetected: z.array(z.unknown()),
          suggestedRewrite: z.unknown().optional(),
        }),
      });

      const result = await provider.generateObject({
        taskType: "rule_review",
        schema,
        schemaName: "RuleReview",
        messages: [{ role: "user", content: "test" }],
      });

      expect(result.data.summary).toBeTruthy();
      expect(result.data.completionScore).toBe(72);
      expect(result.data.needsMoreInfo).toBe(true);
      expect(result.meta.provider).toBe("mock");
      expect(result.usage.inputTokens).toBe(0);
    });

    it("safety_check taskType で正常に返却する", async () => {
      const schema = z.object({
        passed: z.boolean(),
        riskLevel: z.string(),
        violations: z.array(z.unknown()),
        prohibitedPhrasesDetected: z.array(z.unknown()),
      });

      const result = await provider.generateObject({
        taskType: "safety_check",
        schema,
        schemaName: "SafetyCheck",
        messages: [{ role: "user", content: "test" }],
      });

      expect(result.data.passed).toBe(true);
      expect(result.data.riskLevel).toBe("low");
    });

    it("portfolio_rule_guidance taskType で追加質問なしに未定項目の目安を返す", async () => {
      const result = await provider.generateObject({
        taskType: "portfolio_rule_guidance",
        schema: PortfolioRuleGuidanceResponseSchema,
        schemaName: "PortfolioRuleGuidance",
        messages: [{ role: "user", content: "ユーザーの回答一覧:" }],
      });

      expect(result.data.question).toBeNull();
      expect(result.data.readyToReview).toBe(true);
      expect(result.data.progress).toBe(100);
      expect(result.data.suggestions).toHaveLength(2);
      expect(result.data.suggestions.map((item) => item.title)).toEqual([
        "慎重寄り",
        "中間の案",
      ]);
    });

    it("参考案は未定項目のみを含み、確定済み項目を含まない", async () => {
      const result = await provider.generateObject({
        taskType: "portfolio_rule_guidance",
        schema: PortfolioRuleGuidanceResponseSchema,
        schemaName: "PortfolioRuleGuidance",
        messages: [{ role: "user", content: "ユーザーの回答一覧:" }],
      });

      for (const suggestion of result.data.suggestions) {
        expect(suggestion.draft.riskTolerance).toBeUndefined();
        expect(suggestion.draft.maxPositionCount).toBeUndefined();
        expect(Object.keys(suggestion.draft)).toEqual(["minCashPercent"]);
      }
    });

    it("回答間の矛盾を consistencyNotes として返す", async () => {
      const result = await provider.generateObject({
        taskType: "portfolio_rule_guidance",
        schema: PortfolioRuleGuidanceResponseSchema,
        schemaName: "PortfolioRuleGuidance",
        messages: [{ role: "user", content: "ユーザーの回答一覧:" }],
      });

      expect(result.data.consistencyNotes.length).toBeGreaterThan(0);
    });

    it("未定義の schemaName/taskType は空オブジェクトを返す", async () => {
      const schema = z.object({});

      const result = await provider.generateObject({
        taskType: "eval",
        schema,
        schemaName: "Unknown",
        messages: [{ role: "user", content: "test" }],
      });

      expect(result.data).toEqual({});
    });

    it("スキーマに合わない場合は AIProviderError を投げる", async () => {
      const schema = z.object({ requiredField: z.string() });

      await expect(
        provider.generateObject({
          taskType: "eval",
          schema,
          schemaName: "Unknown",
          messages: [{ role: "user", content: "test" }],
        }),
      ).rejects.toThrow(AIProviderError);
    });
  });

  describe("generateText", () => {
    it("固定文字列を返す", async () => {
      const result = await provider.generateText({
        taskType: "eval",
        messages: [{ role: "user", content: "test" }],
      });

      expect(result.text).toBe("これはMock Providerによる応答です。");
      expect(result.meta.provider).toBe("mock");
      expect(result.usage.totalTokens).toBe(0);
    });
  });
});
