import { beforeEach, describe, expect, it, vi } from "vitest";
import { listNewsAssessments } from "@/features/news/services/news-assess-service";

vi.mock("@/lib/db/database-client", () => ({
  createDatabaseClient: vi.fn(),
}));

import { createDatabaseClient } from "@/lib/db/database-client";

const mockSingle = vi.fn();
const mockEqUser = vi.fn(() => ({ single: mockSingle }));
const mockEqId = vi.fn(() => ({ eq: mockEqUser }));
const mockSelect = vi.fn(() => ({ eq: mockEqId }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createDatabaseClient).mockResolvedValue({ from: mockFrom } as never);
});

describe("news assessment ownership", () => {
  it("does not expose another user's rule news history", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: "No rows" },
    });

    await expect(
      listNewsAssessments({ userId: "user-b", sessionId: "session-a" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    expect(mockFrom).toHaveBeenCalledWith("rule_design_sessions");
    expect(mockEqUser).toHaveBeenCalledWith("user_id", "user-b");
  });
});
