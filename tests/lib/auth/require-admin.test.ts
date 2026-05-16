import { describe, expect, it, vi, beforeEach } from "vitest";
import { requireAdmin } from "@/lib/auth/require-admin";
import { AppError } from "@/lib/errors/app-error";

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: vi.fn(),
}));

import { requireUser } from "@/lib/auth/require-user";

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user when role is admin", async () => {
    const mockUser = { id: "admin-1", app_metadata: { role: "admin" } };
    vi.mocked(requireUser).mockResolvedValueOnce(mockUser as any);
    const result = await requireAdmin();
    expect(result).toEqual(mockUser);
  });

  it("throws AppError when role is not admin", async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: "user-1",
      app_metadata: { role: "user" },
    } as any);
    await expect(requireAdmin()).rejects.toThrow(AppError);
    await expect(requireAdmin()).rejects.toThrow("管理者権限が必要です。");
    await expect(requireAdmin()).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
  });

  it("throws AppError when role is missing", async () => {
    vi.mocked(requireUser).mockResolvedValue({
      id: "user-1",
      app_metadata: {},
    } as any);
    await expect(requireAdmin()).rejects.toThrow(AppError);
    await expect(requireAdmin()).rejects.toThrow("管理者権限が必要です。");
  });
});
