import { describe, expect, it, vi, beforeEach } from "vitest";
import { saveRuleAnswer } from "@/features/rules/services/rule-answer-service";
import { AppError } from "@/lib/errors/app-error";

vi.mock("@/lib/db/supabase-server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/features/rules/services/rule-draft-service", () => ({
  applyAnswerToRuleJson: vi.fn(),
}));

import { createClient } from "@/lib/db/supabase-server";
import { applyAnswerToRuleJson } from "@/features/rules/services/rule-draft-service";

const mockSingle = vi.fn();
const mockEqB = vi.fn(() => ({ single: mockSingle }));
const mockEqA = vi.fn(() => ({ eq: mockEqB }));
const mockSelect = vi.fn(() => ({ eq: mockEqA }));
const mockInsertSelect = vi.fn(() => ({ single: mockSingle }));
const mockInsert = vi.fn(() => ({ select: mockInsertSelect }));
const mockUpdateEq = vi.fn(() => ({ eq: vi.fn() }));
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockSingle.mockReset();
  vi.mocked(createClient).mockResolvedValue({
    from: mockFrom,
  } as unknown);
  vi.mocked(applyAnswerToRuleJson).mockResolvedValue({ investmentThesis: "test" });
});

describe("saveRuleAnswer", () => {
  it("saves answer and updates rule json", async () => {
    mockSingle
      .mockResolvedValueOnce({ data: { id: "answer-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "question-1" }, error: null });

    const result = await saveRuleAnswer({
      userId: "user-1",
      sessionId: "session-1",
      questionId: "question-1",
      questionKey: "investment_thesis",
      answerText: "Growth",
      answerJson: null,
    });

    expect(result.answerId).toBe("answer-1");
    expect(result.sessionId).toBe("session-1");
    expect(result.ruleJson).toEqual({ investmentThesis: "test" });
    expect(mockFrom).toHaveBeenCalledWith("rule_answers");
    expect(mockFrom).toHaveBeenCalledWith("rule_questions");
  });

  it("saves answer without questionId (no question update)", async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: "answer-2" }, error: null });

    const result = await saveRuleAnswer({
      userId: "user-1",
      sessionId: "session-1",
      questionKey: "custom_key",
      answerText: "Note",
      answerJson: null,
    });

    expect(result.answerId).toBe("answer-2");
    expect(mockFrom).toHaveBeenCalledWith("rule_answers");
  });

  it("throws 500 when answer insert fails", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: "insert failed" } });

    await expect(
      saveRuleAnswer({
        userId: "user-1",
        sessionId: "session-1",
        questionKey: "investment_thesis",
        answerJson: null,
      }),
    ).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      status: 500,
    });
  });
});
