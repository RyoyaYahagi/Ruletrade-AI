import { beforeEach, describe, expect, it, vi } from "vitest";
import { listTargets } from "@/features/portfolio/services/portfolio-target-service";

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

describe("portfolio target ownership", () => {
  it("does not list another user's portfolio targets", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: "No rows" },
    });

    await expect(
      listTargets({ userId: "user-b", portfolioId: "portfolio-a" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    expect(mockFrom).toHaveBeenCalledWith("portfolios");
    expect(mockEqUser).toHaveBeenCalledWith("user_id", "user-b");
  });
});
