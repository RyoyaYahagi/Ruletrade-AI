import { describe, expect, it, vi, beforeEach } from "vitest";
import { assertOwnRuleSession } from "@/features/rules/services/rule-ownership-service";
import { AppError } from "@/lib/errors/app-error";

vi.mock("@/lib/db/supabase-server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/db/supabase-server";

const mockSingle = vi.fn();
const mockEqB = vi.fn(() => ({ single: mockSingle }));
const mockEqA = vi.fn(() => ({ eq: mockEqB }));
const mockSelect = vi.fn(() => ({ eq: mockEqA }));
const mockFrom = vi.fn(() => ({
  select: mockSelect,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createClient).mockResolvedValue({
    from: mockFrom,
  } as unknown);
});

describe("assertOwnRuleSession", () => {
  it("returns session data when user owns the session", async () => {
    mockSingle.mockResolvedValue({
      data: { id: "session-1", user_id: "user-1", status: "in_progress" },
      error: null,
    });

    const result = await assertOwnRuleSession({
      userId: "user-1",
      sessionId: "session-1",
    });

    expect(result).toEqual({
      id: "session-1",
      user_id: "user-1",
      status: "in_progress",
    });
    expect(mockFrom).toHaveBeenCalledWith("rule_design_sessions");
    expect(mockSelect).toHaveBeenCalledWith("id, user_id, status");
  });

  it("throws 404 when session is not found", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: "not found" },
    });

    await expect(
      assertOwnRuleSession({ userId: "user-1", sessionId: "session-1" }),
    ).rejects.toThrow(AppError);

    await expect(
      assertOwnRuleSession({ userId: "user-1", sessionId: "session-1" }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });

  it("throws 404 when session belongs to another user", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: "not found" },
    });

    await expect(
      assertOwnRuleSession({ userId: "user-2", sessionId: "session-1" }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });
});
