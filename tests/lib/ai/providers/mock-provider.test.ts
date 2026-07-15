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

    it("portfolio_rule_guidance taskType で段階的なガイドを返す", async () => {
      const result = await provider.generateObject({
        taskType: "portfolio_rule_guidance",
        schema: PortfolioRuleGuidanceResponseSchema,
        schemaName: "PortfolioRuleGuidance",
        messages: [
          { role: "user", content: "現在のターン: 0" },
        ],
      });

      expect(result.data.question?.key).toBe("risk_tolerance");
      expect(result.data.question?.explanation).toContain("例えば");
      expect(result.data.suggestions).toEqual([]);
      expect(result.data.readyToReview).toBe(false);
    });

    it("共通ルールでは投資期間を質問しない", async () => {
      const volatilityResult = await provider.generateObject({
        taskType: "portfolio_rule_guidance",
        schema: PortfolioRuleGuidanceResponseSchema,
        schemaName: "PortfolioRuleGuidance",
        messages: [{ role: "user", content: "現在のターン: 1" }],
      });
      const lossResult = await provider.generateObject({
        taskType: "portfolio_rule_guidance",
        schema: PortfolioRuleGuidanceResponseSchema,
        schemaName: "PortfolioRuleGuidance",
        messages: [{ role: "user", content: "現在のターン: 2" }],
      });

      expect(volatilityResult.data.question?.key).toBe("volatility_tolerance");
      expect(lossResult.data.question?.key).toBe("single_trade_loss_tolerance");
      expect(volatilityResult.data.question?.text).not.toContain("投資期間");
      expect(lossResult.data.question?.text).not.toContain("投資期間");
    });

    it("条件整理後に複数の参考案を返す", async () => {
      const result = await provider.generateObject({
        taskType: "portfolio_rule_guidance",
        schema: PortfolioRuleGuidanceResponseSchema,
        schemaName: "PortfolioRuleGuidance",
        messages: [{ role: "user", content: "現在のターン: 3" }],
      });

      expect(result.data.question).toBeNull();
      expect(result.data.suggestions).toHaveLength(3);
      expect(result.data.suggestions.map((item) => item.title)).toEqual([
        "慎重寄り",
        "中間の案",
        "変動許容寄り",
      ]);
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
