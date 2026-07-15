import { beforeEach, describe, expect, it, vi } from "vitest";
import { guidePortfolioCommonRule } from "@/features/portfolio/services/portfolio-rule-guidance-service";

const {
  mockCallAi,
  mockGetAiDeveloperSettings,
  mockRunComplianceGate,
  mockLoadPortfolioState,
} = vi.hoisted(() => ({
  mockCallAi: vi.fn(),
  mockGetAiDeveloperSettings: vi.fn(),
  mockRunComplianceGate: vi.fn(),
  mockLoadPortfolioState: vi.fn(),
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

vi.mock("@/features/portfolio/services/portfolio-compliance-service", () => ({
  loadPortfolioState: mockLoadPortfolioState,
}));

const guidance = {
  message: "目的を整理します。",
  question: null,
  suggestions: [
    {
      key: "balanced",
      title: "中間の案",
      summary: "条件に合わせた参考案です。",
      tradeoff: "両方の妥協が必要です。",
      draft: { maxPositionPercent: 10 },
    },
  ],
  consistencyNotes: ["回答間に注意したい点があります。"],
  progress: 100,
  readyToReview: true,
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
  mockLoadPortfolioState.mockResolvedValue({
    cashAmount: 0,
    positions: [],
  });
});

describe("guidePortfolioCommonRule", () => {
  it("calls the structured AI guide and compliance gate", async () => {
    const result = await guidePortfolioCommonRule({
      userId: "user-1",
      requestId: "request-1",
      input: { answers: [], draft: {} },
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
    expect(mockRunComplianceGate.mock.calls[0]?.[0].text).toContain(
      "回答間に注意したい点があります。",
    );
  });

  it("includes holdings summary and decided draft in the prompt", async () => {
    mockLoadPortfolioState.mockResolvedValue({
      cashAmount: 100000,
      positions: [
        {
          ticker: "5803",
          market_value: 900000,
          asset_type: "stock",
          market: "JP",
        },
      ],
    });

    await guidePortfolioCommonRule({
      userId: "user-1",
      input: {
        answers: [
          {
            key: "max_position_count",
            question: "値動きやニュースを無理なく追える銘柄数は、いくつくらいですか？",
            answer: "10銘柄くらいまで",
            value: "10",
          },
          {
            key: "risk_tolerance",
            question: "資産全体が2割下がったとき、あなたの気持ちに一番近いのはどれですか？",
            answer: "まだわからない",
            value: "undecided",
          },
        ],
        draft: {},
      },
    });

    const promptArg = mockCallAi.mock.calls[0]?.[0].prompt as string;
    expect(promptArg).toContain("保有銘柄数: 1銘柄");
    expect(promptArg).toContain("maxPositionCount");
    expect(promptArg).toContain("risk_tolerance");
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
        input: { answers: [], draft: {} },
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
        input: { answers: [], draft: {} },
      }),
    ).rejects.toMatchObject({
      code: "AI_PROVIDER_ERROR",
      status: 502,
      retryable: true,
    });
  });
});
