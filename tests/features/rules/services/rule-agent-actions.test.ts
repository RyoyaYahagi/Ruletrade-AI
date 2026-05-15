import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  runRuleGeneration,
  runRuleReview,
  runRuleEvaluation,
  runRuleExplanation,
} from "@/features/rules/services/rule-agent-actions";

vi.mock("@/lib/auth/get-current-user", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/features/rules/services/rule-agent-service", () => ({
  generateTradingRule: vi.fn(),
  reviewTradingRule: vi.fn(),
  evaluateTradingRule: vi.fn(),
  explainTradingRule: vi.fn(),
}));

import { getCurrentUser } from "@/lib/auth/get-current-user";
import {
  generateTradingRule,
  reviewTradingRule,
  evaluateTradingRule,
  explainTradingRule,
} from "@/features/rules/services/rule-agent-service";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("rule-agent-actions auth", () => {
  it("runRuleGeneration returns error when not logged in", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await runRuleGeneration({ userIntent: "test" });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("ログイン");
    expect(generateTradingRule).not.toHaveBeenCalled();
  });

  it("runRuleReview returns error when not logged in", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await runRuleReview({
      rule: {
        investmentThesis: "test",
        timeHorizon: "short_term",
        entryPlan: { currency: "JPY", entryConditions: [] },
        riskManagement: { riskNotes: [] },
        exitPlan: { exitConditions: [] },
        earningsPolicy: { policy: "undecided" },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("ログイン");
    expect(reviewTradingRule).not.toHaveBeenCalled();
  });

  it("runRuleEvaluation returns error when not logged in", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await runRuleEvaluation({
      rule: {
        investmentThesis: "test",
        timeHorizon: "short_term",
        entryPlan: { currency: "JPY", entryConditions: [] },
        riskManagement: { riskNotes: [] },
        exitPlan: { exitConditions: [] },
        earningsPolicy: { policy: "undecided" },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("ログイン");
    expect(evaluateTradingRule).not.toHaveBeenCalled();
  });

  it("runRuleExplanation returns error when not logged in", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await runRuleExplanation({
      rule: {
        investmentThesis: "test",
        timeHorizon: "short_term",
        entryPlan: { currency: "JPY", entryConditions: [] },
        riskManagement: { riskNotes: [] },
        exitPlan: { exitConditions: [] },
        earningsPolicy: { policy: "undecided" },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("ログイン");
    expect(explainTradingRule).not.toHaveBeenCalled();
  });
});
