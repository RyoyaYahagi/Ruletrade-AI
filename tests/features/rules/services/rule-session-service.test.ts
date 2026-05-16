import { describe, expect, it, vi, beforeEach } from "vitest";
import { updateRuleSession } from "@/features/rules/services/rule-session-service";

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
});

describe("updateRuleSession validation", () => {
  it("throws on invalid ruleJson", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { status: "in_progress" },
      error: null,
    });

    await expect(
      updateRuleSession({
        userId: "user-1",
        sessionId: "session-1",
        ruleJson: { entryPlan: { targetPriceMin: "not-a-number" } },
      }),
    ).rejects.toThrow("ruleJsonの形式が正しくありません");
  });

  it("allows valid status transition", async () => {
    mockSingle
      .mockResolvedValueOnce({
        data: { status: "in_progress" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: "session-1",
          status: "needs_more_info",
          rule_json: {},
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

    const result = await updateRuleSession({
      userId: "user-1",
      sessionId: "session-1",
      status: "needs_more_info",
    });

    expect(result.session.status).toBe("needs_more_info");
  });

  it("throws on invalid status transition", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { status: "finalized" },
      error: null,
    });

    await expect(
      updateRuleSession({
        userId: "user-1",
        sessionId: "session-1",
        status: "draft",
      }),
    ).rejects.toThrow("遷移は許可されていません");
  });
});
