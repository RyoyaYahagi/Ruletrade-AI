import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db/supabase-server", () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from "@/lib/db/supabase-server";

describe("getCurrentUser", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllEnvs();
  });

  it("returns mock user when MOCK_AUTH_EMAIL is set", async () => {
    process.env.MOCK_AUTH_EMAIL = "mock@example.com";
    process.env.MOCK_AUTH_USER_ID = "mock-id-123";
    const { getCurrentUser } = await import("@/lib/auth/get-current-user");
    const user = await getCurrentUser();
    expect(user).toMatchObject({
      id: "mock-id-123",
      email: "mock@example.com",
      app_metadata: { role: "admin" },
    });
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("returns mock user with default id when MOCK_AUTH_USER_ID is not set", async () => {
    process.env.MOCK_AUTH_EMAIL = "mock@example.com";
    delete process.env.MOCK_AUTH_USER_ID;
    const { getCurrentUser } = await import("@/lib/auth/get-current-user");
    const user = await getCurrentUser();
    expect(user?.id).toBe("mock-user-id");
    expect(user?.email).toBe("mock@example.com");
  });

  it("returns null when createClient throws", async () => {
    delete process.env.MOCK_AUTH_EMAIL;
    vi.mocked(createServerClient).mockRejectedValueOnce(new Error("db error"));
    const { getCurrentUser } = await import("@/lib/auth/get-current-user");
    const user = await getCurrentUser();
    expect(user).toBeNull();
  });

  it("returns user from supabase when authenticated", async () => {
    delete process.env.MOCK_AUTH_EMAIL;
    const mockUser = { id: "real-user", email: "real@example.com" };
    vi.mocked(createServerClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({
          data: { user: mockUser },
          error: null,
        }),
      },
    } as unknown);
    const { getCurrentUser } = await import("@/lib/auth/get-current-user");
    const user = await getCurrentUser();
    expect(user).toEqual(mockUser);
  });

  it("returns null when supabase auth returns error", async () => {
    delete process.env.MOCK_AUTH_EMAIL;
    vi.mocked(createServerClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValueOnce({
          data: { user: null },
          error: new Error("auth error"),
        }),
      },
    } as unknown);
    const { getCurrentUser } = await import("@/lib/auth/get-current-user");
    const user = await getCurrentUser();
    expect(user).toBeNull();
  });
});
