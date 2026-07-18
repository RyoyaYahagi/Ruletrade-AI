import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors/app-error";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  assertOwnRuleSession: vi.fn(),
  trackRuleEngagement: vi.fn(),
  toErrorResponse: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/features/rules/services/rule-ownership-service", () => ({
  assertOwnRuleSession: mocks.assertOwnRuleSession,
}));
vi.mock("@/features/rules/services/rule-analytics-service", () => ({
  trackRuleEngagement: mocks.trackRuleEngagement,
}));
vi.mock("@/lib/errors/to-error-response", () => ({ toErrorResponse: mocks.toErrorResponse }));

import { POST } from "@/app/api/rule-sessions/[sessionId]/engagement/route";

describe("POST /api/rule-sessions/[sessionId]/engagement", () => {
  it("does not record another user's session event", async () => {
    const error = new AppError("FORBIDDEN", "forbidden", 403);
    mocks.requireUser.mockResolvedValueOnce({ id: "user-1" });
    mocks.assertOwnRuleSession.mockRejectedValueOnce(error);
    const response = new Response(JSON.stringify({ ok: false }), { status: 403 });
    mocks.toErrorResponse.mockReturnValueOnce(response);

    const result = await POST(
      new Request("http://localhost/api/rule-sessions/session-2/engagement", {
        method: "POST",
        body: JSON.stringify({
          eventId: "00000000-0000-4000-8000-000000000001",
          eventName: "question_viewed",
          questionId: "00000000-0000-4000-8000-000000000002",
          questionKey: "holding_purpose",
        }),
      }),
      { params: Promise.resolve({ sessionId: "session-2" }) },
    );

    expect(result).toBe(response);
    expect(mocks.trackRuleEngagement).not.toHaveBeenCalled();
  });
});
