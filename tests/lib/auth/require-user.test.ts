import { describe, expect, it, vi, beforeEach } from "vitest";
import { requireUser } from "@/lib/auth/require-user";
import { AppError } from "@/lib/errors/app-error";

vi.mock("@/lib/auth/get-current-user", () => ({
  getCurrentUser: vi.fn(),
}));

import { getCurrentUser } from "@/lib/auth/get-current-user";

describe("requireUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user when authenticated", async () => {
    const mockUser = { id: "user-1", email: "user@example.com" };
    vi.mocked(getCurrentUser).mockResolvedValueOnce(mockUser as any);
    const result = await requireUser();
    expect(result).toEqual(mockUser);
  });

  it("throws AppError when not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    await expect(requireUser()).rejects.toThrow(AppError);
    await expect(requireUser()).rejects.toThrow("ログインが必要です。");
    await expect(requireUser()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
    });
  });
});
