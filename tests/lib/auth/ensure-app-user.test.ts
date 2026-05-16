import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ensureAppUser } from "@/lib/auth/ensure-app-user";

vi.mock("@/lib/db/supabase-server", () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from "@/lib/db/supabase-server";

const mockSingle = vi.fn();
const mockSelect = vi.fn(() => ({ single: mockSingle }));
const mockUpsert = vi.fn(() => ({ select: mockSelect }));
const mockFrom = vi.fn(() => ({ upsert: mockUpsert }));

describe("ensureAppUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createServerClient).mockResolvedValue({
      from: mockFrom,
    } as unknown);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns mock user when MOCK_AUTH is true", async () => {
    vi.stubEnv("MOCK_AUTH", "true");
    const user = { id: "mock-id", email: "mock@example.com" };
    const result = await ensureAppUser(user as unknown);
    expect(result).toEqual({ id: "mock-id", email: "mock@example.com" });
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("upserts app_user and returns data on success", async () => {
    vi.stubEnv("MOCK_AUTH", "false");
    const user = { id: "real-id", email: "real@example.com" };
    mockSingle.mockResolvedValueOnce({
      data: { id: "real-id", email: "real@example.com" },
      error: null,
    });
    const result = await ensureAppUser(user as unknown);
    expect(mockFrom).toHaveBeenCalledWith("app_users");
    expect(mockUpsert).toHaveBeenCalledWith(
      { id: "real-id", email: "real@example.com" },
      { onConflict: "id" },
    );
    expect(result).toEqual({ id: "real-id", email: "real@example.com" });
  });

  it("throws when supabase returns error", async () => {
    vi.stubEnv("MOCK_AUTH", "false");
    const user = { id: "real-id", email: "real@example.com" };
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: new Error("db error"),
    });
    await expect(ensureAppUser(user as unknown)).rejects.toThrow("db error");
  });
});
