import { describe, expect, it, vi, beforeEach } from "vitest";
import { applyAnswerToRuleJson } from "@/features/rules/services/rule-draft-service";
import { AppError } from "@/lib/errors/app-error";

vi.mock("@/lib/db/supabase-server", () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from "@/lib/db/supabase-server";

const mockSingle = vi.fn();
const mockEqB = vi.fn(() => ({ single: mockSingle }));
const mockEqA = vi.fn(() => ({ eq: mockEqB }));
const mockSelect = vi.fn(() => ({ eq: mockEqA }));
const mockUpdateSelect = vi.fn(() => ({ single: mockSingle }));
const mockUpdateEqB = vi.fn(() => ({ select: mockUpdateSelect }));
const mockUpdateEqA = vi.fn(() => ({ eq: mockUpdateEqB }));
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEqA }));
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  update: mockUpdate,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createServerClient).mockResolvedValue({
    from: mockFrom,
  } as unknown);
});

function mockSession(ruleJson: unknown) {
  mockSingle.mockResolvedValueOnce({
    data: { id: "session-1", rule_json: ruleJson, question_count: 2 },
    error: null,
  });
}

describe("applyAnswerToRuleJson", () => {
  it("updates investmentThesis for investment_thesis key", async () => {
    mockSession({});
    mockSingle.mockResolvedValueOnce({
      data: { rule_json: { investmentThesis: "Growth story" } },
      error: null,
    });

    const result = await applyAnswerToRuleJson({
      userId: "user-1",
      sessionId: "session-1",
      questionKey: "investment_thesis",
      answerJson: null,
      answerText: "Growth story",
    });

    expect(result).toMatchObject({ investmentThesis: "Growth story" });
  });

  it("updates timeHorizon for time_horizon key", async () => {
    mockSession({});
    mockSingle.mockResolvedValueOnce({
      data: { rule_json: { timeHorizon: "long_term" } },
      error: null,
    });

    const result = await applyAnswerToRuleJson({
      userId: "user-1",
      sessionId: "session-1",
      questionKey: "time_horizon",
      answerJson: { value: "long_term" },
    });

    expect(result).toMatchObject({ timeHorizon: "long_term" });
  });

  it("updates entryPlan for entry_price_range key", async () => {
    mockSession({});
    mockSingle.mockResolvedValueOnce({
      data: {
        rule_json: {
          entryPlan: {
            targetPriceMin: 1000,
            targetPriceMax: 1200,
            currency: "JPY",
          },
        },
      },
      error: null,
    });

    const result = await applyAnswerToRuleJson({
      userId: "user-1",
      sessionId: "session-1",
      questionKey: "entry_price_range",
      answerJson: { min: 1000, max: 1200, currency: "JPY" },
    });

    expect(result).toMatchObject({
      entryPlan: {
        targetPriceMin: 1000,
        targetPriceMax: 1200,
        currency: "JPY",
      },
    });
  });

  it("updates stopLossRule for stop_loss_rule key", async () => {
    mockSession({});
    mockSingle.mockResolvedValueOnce({
      data: {
        rule_json: {
          riskManagement: { stopLossRule: "Cut at -5%" },
        },
      },
      error: null,
    });

    const result = await applyAnswerToRuleJson({
      userId: "user-1",
      sessionId: "session-1",
      questionKey: "stop_loss_rule",
      answerJson: null,
      answerText: "Cut at -5%",
    });

    expect(result).toMatchObject({
      riskManagement: { stopLossRule: "Cut at -5%" },
    });
  });

  it("appends freeNotes for unknown questionKey", async () => {
    mockSession({ freeNotes: "Existing note" });
    mockSingle.mockResolvedValueOnce({
      data: {
        rule_json: { freeNotes: "Existing note\nNew note" },
      },
      error: null,
    });

    const result = await applyAnswerToRuleJson({
      userId: "user-1",
      sessionId: "session-1",
      questionKey: "custom_question",
      answerJson: null,
      answerText: "New note",
    });

    expect(result).toMatchObject({ freeNotes: "Existing note\nNew note" });
  });

  it("throws 404 when session not found", async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "not found" },
    });

    await expect(
      applyAnswerToRuleJson({
        userId: "user-1",
        sessionId: "session-1",
        questionKey: "investment_thesis",
        answerJson: null,
        answerText: "test",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("throws validation error when ruleJson is invalid", async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        id: "session-1",
        rule_json: { timeHorizon: "invalid_value" },
        question_count: 0,
      },
      error: null,
    });

    await expect(
      applyAnswerToRuleJson({
        userId: "user-1",
        sessionId: "session-1",
        questionKey: "investment_thesis",
        answerJson: null,
        answerText: "test",
      }),
    ).rejects.toThrow();
  });
});
