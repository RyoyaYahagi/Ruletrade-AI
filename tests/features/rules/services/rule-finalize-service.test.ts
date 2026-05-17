import { beforeEach, describe, expect, it, vi } from "vitest";
import { finalizeRuleSession } from "@/features/rules/services/rule-finalize-service";

vi.mock("@/lib/db/supabase-server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/features/rules/services/rule-session-service", () => ({
  createRuleVersion: vi.fn(),
}));

import { createClient } from "@/lib/db/supabase-server";
import { createRuleVersion } from "@/features/rules/services/rule-session-service";

const mockSessionSingle = vi.fn();
const mockUpdateSingle = vi.fn();
const mockUpdateSelect = vi.fn(() => ({ single: mockUpdateSingle }));
const mockUpdateEqUser = vi.fn(() => ({ select: mockUpdateSelect }));
const mockUpdateEqSession = vi.fn(() => ({ eq: mockUpdateEqUser }));
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEqSession }));
const mockSelectEqUser = vi.fn(() => ({ single: mockSessionSingle }));
const mockSelectEqSession = vi.fn(() => ({ eq: mockSelectEqUser }));
const mockSelect = vi.fn(() => ({ eq: mockSelectEqSession }));
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  update: mockUpdate,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createClient).mockResolvedValue({
    from: mockFrom,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
});

describe("finalizeRuleSession", () => {
  it("rejects sessions that have not passed the quality gate even when score is 80 or higher", async () => {
    mockSessionSingle.mockResolvedValueOnce({
      data: {
        id: "session-1",
        completion_score: 88,
        quality_gate_status: "needs_more_info",
        rule_json: {},
        status: "needs_more_info",
      },
      error: null,
    });

    await expect(
      finalizeRuleSession({
        userId: "user-1",
        sessionId: "session-1",
        force: false,
      }),
    ).rejects.toThrow("Quality Gateを通過していない");

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(createRuleVersion).not.toHaveBeenCalled();
  });

  it("finalizes only after score and quality gate state are both ready", async () => {
    mockSessionSingle.mockResolvedValueOnce({
      data: {
        id: "session-1",
        completion_score: 96,
        quality_gate_status: "passed",
        rule_json: { investmentThesis: "test" },
        status: "quality_gate_passed",
      },
      error: null,
    });
    mockUpdateSingle.mockResolvedValueOnce({
      data: { id: "session-1" },
      error: null,
    });

    const result = await finalizeRuleSession({
      userId: "user-1",
      sessionId: "session-1",
      force: false,
    });

    expect(result).toEqual({ sessionId: "session-1", status: "finalized" });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "finalized" }),
    );
    expect(createRuleVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        sessionId: "session-1",
        changeReason: "完成版として保存",
        createdBy: "user",
      }),
    );
  });
});
