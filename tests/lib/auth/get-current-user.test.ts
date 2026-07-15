import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockCookieGet = vi.fn();
const mockGetUserBySessionToken = vi.fn();

vi.mock("@/lib/auth/local-auth", () => ({
  AUTH_SESSION_COOKIE: "ruletrade_session",
  getUserBySessionToken: mockGetUserBySessionToken,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: mockCookieGet,
  })),
}));

describe("getCurrentUser", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockCookieGet.mockReturnValue(undefined);
    mockGetUserBySessionToken.mockReturnValue(null);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllEnvs();
  });

  it("returns mock user when E2E_TEST_AUTH is enabled", async () => {
    process.env.E2E_TEST_AUTH = "true";
    process.env.MOCK_AUTH_EMAIL = "mock@example.com";
    process.env.MOCK_AUTH_USER_ID = "mock-id-123";
    process.env.MOCK_AUTH_ROLE = "admin";

    const { getCurrentUser } = await import("@/lib/auth/get-current-user");
    const user = await getCurrentUser();

    expect(user).toMatchObject({
      id: "mock-id-123",
      email: "mock@example.com",
      app_metadata: { role: "admin" },
    });
    expect(mockGetUserBySessionToken).not.toHaveBeenCalled();
  });

  it("returns mock user with default id when E2E_TEST_AUTH is enabled", async () => {
    process.env.E2E_TEST_AUTH = "true";
    process.env.MOCK_AUTH_EMAIL = "mock@example.com";
    delete process.env.MOCK_AUTH_USER_ID;

    const { getCurrentUser } = await import("@/lib/auth/get-current-user");
    const user = await getCurrentUser();

    expect(user?.id).toBe("mock-user-id");
    expect(user?.email).toBe("mock@example.com");
  });

  it("does not enable mock auth without the explicit E2E flag", async () => {
    delete process.env.E2E_TEST_AUTH;
    process.env.MOCK_AUTH_EMAIL = "mock@example.com";

    const { getCurrentUser } = await import("@/lib/auth/get-current-user");
    const user = await getCurrentUser();

    expect(user).toBeNull();
    expect(mockGetUserBySessionToken).toHaveBeenCalledWith(undefined);
  });

  it("returns null when the local session lookup throws", async () => {
    delete process.env.MOCK_AUTH_EMAIL;
    mockGetUserBySessionToken.mockImplementationOnce(() => {
      throw new Error("db error");
    });

    const { getCurrentUser } = await import("@/lib/auth/get-current-user");
    const user = await getCurrentUser();

    expect(user).toBeNull();
  });

  it("returns guest user when guest session cookie is set outside production", async () => {
    delete process.env.MOCK_AUTH_EMAIL;
    process.env.NODE_ENV = "development";
    mockCookieGet.mockImplementation((name: string) =>
      name === "ruletrade_guest_session" ? { value: "guest" } : undefined,
    );

    const { getCurrentUser } = await import("@/lib/auth/get-current-user");
    const user = await getCurrentUser();

    expect(user).toMatchObject({
      id: "guest-user",
      email: "guest@ruletrade.local",
      app_metadata: { role: "user", provider: "guest" },
    });
    expect(mockGetUserBySessionToken).not.toHaveBeenCalled();
  });

  it("returns user from the local session", async () => {
    delete process.env.MOCK_AUTH_EMAIL;
    const mockUser = {
      id: "real-user",
      email: "real@example.com",
      app_metadata: { role: "user", provider: "local" },
      user_metadata: {},
      aud: "authenticated",
      created_at: "2026-07-14T00:00:00.000Z",
    };
    mockCookieGet.mockImplementation((name: string) =>
      name === "ruletrade_session" ? { value: "session-token" } : undefined,
    );
    mockGetUserBySessionToken.mockReturnValueOnce(mockUser);

    const { getCurrentUser } = await import("@/lib/auth/get-current-user");
    const user = await getCurrentUser();

    expect(user).toEqual(mockUser);
    expect(mockGetUserBySessionToken).toHaveBeenCalledWith("session-token");
  });
});
