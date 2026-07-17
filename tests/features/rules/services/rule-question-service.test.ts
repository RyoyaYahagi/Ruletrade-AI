import { beforeEach, describe, expect, it, vi } from "vitest";

import { skipRuleQuestion } from "@/features/rules/services/rule-question-service";

vi.mock("@/lib/db/database-client", () => ({
  createDatabaseClient: vi.fn(),
}));

import { createDatabaseClient } from "@/lib/db/database-client";

const mockQuestionSingle = vi.fn();
const mockQuestionSelect = vi.fn(() => ({ single: mockQuestionSingle }));
const mockQuestionEqStatus = vi.fn(() => ({ select: mockQuestionSelect }));
const mockQuestionEqUser = vi.fn(() => ({ eq: mockQuestionEqStatus }));
const mockQuestionEqSession = vi.fn(() => ({ eq: mockQuestionEqUser }));
const mockQuestionEqId = vi.fn(() => ({ eq: mockQuestionEqSession }));
const mockQuestionUpdate = vi.fn(() => ({ eq: mockQuestionEqId }));

const mockSessionSingle = vi.fn();
const mockSessionEqUser = vi.fn(() => ({ single: mockSessionSingle }));
const mockSessionEqId = vi.fn(() => ({ eq: mockSessionEqUser }));
const mockSessionSelect = vi.fn(() => ({ eq: mockSessionEqId }));
const mockSessionUpdateEqUser = vi.fn();
const mockSessionUpdateEqId = vi.fn(() => ({ eq: mockSessionUpdateEqUser }));
const mockSessionUpdate = vi.fn(() => ({ eq: mockSessionUpdateEqId }));

const mockFrom = vi.fn((table: string) => {
  if (table === "rule_questions") {
    return { update: mockQuestionUpdate };
  }
  return { select: mockSessionSelect, update: mockSessionUpdate };
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createDatabaseClient).mockResolvedValue({
    from: mockFrom,
  } as unknown);
  mockSessionUpdateEqUser.mockResolvedValue({ data: [], error: null });
});

describe("skipRuleQuestion", () => {
  it("rejects a question owned by another user", async () => {
    mockQuestionSingle.mockResolvedValue({
      data: null,
      error: { message: "not found" },
    });

    await expect(
      skipRuleQuestion({
        userId: "user-b",
        sessionId: "session-a",
        questionId: "question-a",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    expect(mockQuestionEqUser).toHaveBeenCalledWith("user_id", "user-b");
  });

  it("marks a pending question as skipped and updates progress", async () => {
    mockQuestionSingle.mockResolvedValue({
      data: { id: "question-a", status: "skipped" },
      error: null,
    });
    mockSessionSingle.mockResolvedValue({
      data: { question_count: 2 },
      error: null,
    });

    await expect(
      skipRuleQuestion({
        userId: "user-a",
        sessionId: "session-a",
        questionId: "question-a",
      }),
    ).resolves.toEqual({ question: { id: "question-a", status: "skipped" } });
    expect(mockSessionEqUser).toHaveBeenCalledWith("user_id", "user-a");
  });
});
