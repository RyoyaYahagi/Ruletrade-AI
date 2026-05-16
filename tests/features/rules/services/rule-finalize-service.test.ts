import { describe, expect, it, vi, beforeEach } from "vitest";
import { finalizeRuleSession } from "@/features/rules/services/rule-finalize-service";
import { AppError } from "@/lib/errors/app-error";

vi.mock("@/lib/db/supabase-server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/features/rules/services/rule-session-service", () => ({
  createRuleVersion: vi.fn(),
}));

import { createServerClient } from "@/lib/db/supabase-server";
import { createRuleVersion } from "@/features/rules/services/rule-session-service";

const mockSingle = vi.fn();
const mockEqB = vi.fn(() => ({ single: mockSingle }));
const mockEqA = vi.fn(() => ({ eq: mockEqB }));
const mockSelect = vi.fn(() => ({ eq: mockEqA }));
const mockUpdateEqB = vi.fn(() => ({ eq: vi.fn() }));
const mockUpdateEqA = vi.fn(() => ({ eq: mockUpdateEqB }));
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEqA }));
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  update: mockUpdate,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockSingle.mockReset();
  vi.mocked(createServerClient).mockResolvedValue({
    from: mockFrom,
  } as unknown);
  vi.mocked(createRuleVersion).mockResolvedValue(undefined);
});

describe("finalizeRuleSession", () => {
  it("finalizes when completionScore is 100 and force is false", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: "session-1", completion_score: 100, quality_gate_status: "passed", rule_json: {} },
      error: null,
    });

    const result = await finalizeRuleSession({
      userId: "user-1",
      sessionId: "session-1",
      force: false,
    });

    expect(result.status).toBe("finalized");
    expect(createRuleVersion).toHaveBeenCalled();
  });

  it("finalizes when completionScore is 0 but force is true", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: "session-1", completion_score: 0, quality_gate_status: "needs_more_info", rule_json: {} },
      error: null,
    });

    const result = await finalizeRuleSession({
      userId: "user-1",
      sessionId: "session-1",
      force: true,
    });

    expect(result.status).toBe("finalized");
    expect(createRuleVersion).toHaveBeenCalled();
  });

  it("throws 400 when completionScore is 0 and force is false", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: "session-1", completion_score: 0, quality_gate_status: "needs_more_info", rule_json: {} },
      error: null,
    });

    await expect(
      finalizeRuleSession({ userId: "user-1", sessionId: "session-1", force: false }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
  });

  it("throws 400 at boundary value 79 with force false", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: "session-1", completion_score: 79, quality_gate_status: "needs_more_info", rule_json: {} },
      error: null,
    });

    await expect(
      finalizeRuleSession({ userId: "user-1", sessionId: "session-1", force: false }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
  });

  it("allows finalization at boundary value 80 with force false", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: "session-1", completion_score: 80, quality_gate_status: "passed", rule_json: {} },
      error: null,
    });

    const result = await finalizeRuleSession({
      userId: "user-1",
      sessionId: "session-1",
      force: false,
    });

    expect(result.status).toBe("finalized");
  });

  it("throws 404 when session not found", async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "not found" },
    });

    await expect(
      finalizeRuleSession({ userId: "user-1", sessionId: "session-1", force: false }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });

  it("throws 500 when update fails", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: "session-1", completion_score: 100, quality_gate_status: "passed", rule_json: {} },
      error: null,
    });

    const finalEq = vi.fn();
    const updateEqB = vi.fn(() => ({ error: { message: "update failed" }, eq: finalEq }));
    const updateEqA = vi.fn(() => ({ eq: updateEqB }));
    mockUpdate.mockImplementationOnce(() => ({ eq: updateEqA }));

    await expect(
      finalizeRuleSession({ userId: "user-1", sessionId: "session-1", force: false }),
    ).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      status: 500,
    });
  });
});
