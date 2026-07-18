import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors/app-error";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  assertOwnRuleSession: vi.fn(),
  getQuestionFeedback: vi.fn(),
  saveQuestionFeedback: vi.fn(),
  toErrorResponse: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/features/rules/services/rule-ownership-service", () => ({
  assertOwnRuleSession: mocks.assertOwnRuleSession,
}));
vi.mock("@/features/rules/services/rule-question-feedback-service", () => ({
  getQuestionFeedback: mocks.getQuestionFeedback,
  saveQuestionFeedback: mocks.saveQuestionFeedback,
}));
vi.mock("@/lib/errors/to-error-response", () => ({
  toErrorResponse: mocks.toErrorResponse,
}));

import { GET } from "@/app/api/rule-sessions/[sessionId]/question-feedback/route";

describe("question feedback API", () => {
  it("別ユーザーのセッションは所有権チェックで拒否する", async () => {
    const response = new Response(JSON.stringify({ ok: false }), { status: 404 });
    mocks.requireUser.mockResolvedValueOnce({ id: "user-b" });
    mocks.assertOwnRuleSession.mockRejectedValueOnce(
      new AppError("NOT_FOUND", "ルール作成セッションが見つかりません。", 404),
    );
    mocks.toErrorResponse.mockReturnValueOnce(response);

    const result = await GET(
      new Request(
        "http://localhost/api/rule-sessions/session-a/question-feedback?questionId=question-a",
      ),
      { params: Promise.resolve({ sessionId: "session-a" }) },
    );

    expect(result).toBe(response);
    expect(mocks.getQuestionFeedback).not.toHaveBeenCalled();
    expect(mocks.assertOwnRuleSession).toHaveBeenCalledWith({
      userId: "user-b",
      sessionId: "session-a",
    });
    expect(mocks.toErrorResponse).toHaveBeenCalledWith(
      expect.objectContaining({ code: "NOT_FOUND", status: 404 }),
      expect.objectContaining({ requestId: expect.any(String) }),
    );
  });
});
