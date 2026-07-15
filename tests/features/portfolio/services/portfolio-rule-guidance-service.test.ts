import { beforeEach, describe, expect, it, vi } from "vitest";
import { guidePortfolioCommonRule } from "@/features/portfolio/services/portfolio-rule-guidance-service";

const {
  mockCallAi,
  mockGetAiDeveloperSettings,
  mockRunComplianceGate,
} = vi.hoisted(() => ({
  mockCallAi: vi.fn(),
  mockGetAiDeveloperSettings: vi.fn(),
  mockRunComplianceGate: vi.fn(),
}));

vi.mock("@/lib/ai/provider-gateway", () => ({
  callAi: mockCallAi,
}));

vi.mock("@/features/ai/services/ai-developer-settings-service", () => ({
  getAiDeveloperSettings: mockGetAiDeveloperSettings,
}));

vi.mock("@/features/legal/services/compliance-gate-service", () => ({
  runComplianceGate: mockRunComplianceGate,
}));

const guidance = {
  message: "目的を整理します。",
  question: {
    key: "purpose",
    text: "このポートフォリオの目的は何ですか？",
    explanation: "目的により考える項目が変わります。",
  },
  suggestions: [
    {
      key: "balanced",
      title: "中間の案",
      summary: "条件に合わせた参考案です。",
      tradeoff: "両方の妥協が必要です。",
      draft: { maxPositionPercent: 10 },
    },
  ],
  progress: 25,
  readyToReview: false,
  guidance: ["目的"],
  disclaimer: "これは投資助言ではありません。",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAiDeveloperSettings.mockResolvedValue({
    provider: "mock",
    model: "mock-model",
  });
  mockCallAi.mockResolvedValue({
    ok: true,
    data: guidance,
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    model: "mock-model",
  });
  mockRunComplianceGate.mockResolvedValue({
    passed: true,
    riskLevel: "low",
    violations: [],
  });
});

describe("guidePortfolioCommonRule", () => {
  it("calls the structured AI guide and compliance gate", async () => {
    const result = await guidePortfolioCommonRule({
      userId: "user-1",
      requestId: "request-1",
      input: { history: [], draft: {} },
    });

    expect(result).toEqual(guidance);
    expect(mockCallAi).toHaveBeenCalledWith(
      expect.objectContaining({
        taskType: "portfolio_rule_guidance",
        agentName: "portfolio_rule_guidance_agent",
        sourceType: "portfolio",
        userId: "user-1",
      }),
    );
    expect(mockRunComplianceGate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        reviewType: "portfolio_rule_guidance",
      }),
    );
  });

  it("does not return AI guidance when compliance blocks it", async () => {
    mockRunComplianceGate.mockResolvedValue({
      passed: false,
      riskLevel: "high",
      violations: [{ type: "other", reason: "blocked" }],
    });

    await expect(
      guidePortfolioCommonRule({
        userId: "user-1",
        input: { history: [], draft: {} },
      }),
    ).rejects.toMatchObject({ code: "SAFETY_FAILED", status: 422 });
  });

  it("maps provider failures to a retryable app error", async () => {
    mockCallAi.mockResolvedValue({
      ok: false,
      error: "provider unavailable",
    });

    await expect(
      guidePortfolioCommonRule({
        userId: "user-1",
        input: { history: [], draft: {} },
      }),
    ).rejects.toMatchObject({
      code: "AI_PROVIDER_ERROR",
      status: 502,
      retryable: true,
    });
  });
});
