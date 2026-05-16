import { describe, expect, it, vi, beforeEach } from "vitest";
import { createServerClient as sut } from "@/lib/db/supabase-server";

const mockCookieStore = {
  getAll: vi.fn(() => []),
  set: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

vi.mock("@/lib/db/env", () => ({
  getPublicSupabaseEnv: vi.fn(() => ({
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "anon-key",
  })),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ mockServerClient: true })),
}));

import { cookies } from "next/headers";
import { getPublicSupabaseEnv } from "@/lib/db/env";
import { createServerClient } from "@supabase/ssr";

describe("createClient (server)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieStore.getAll.mockReturnValue([]);
  });

  it("creates server client with cookies and public env", async () => {
    await sut();
    expect(cookies).toHaveBeenCalled();
    expect(getPublicSupabaseEnv).toHaveBeenCalled();
    expect(createServerClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "anon-key",
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      }),
    );
  });

  it("cookie getAll returns cookieStore.getAll", async () => {
    mockCookieStore.getAll.mockReturnValueOnce([
      { name: "sb-auth", value: "token" },
    ]);
    await sut();
    const callArgs = vi.mocked(createServerClient).mock.calls[0][2];
    const result = callArgs?.cookies?.getAll();
    expect(mockCookieStore.getAll).toHaveBeenCalled();
    expect(result).toEqual([{ name: "sb-auth", value: "token" }]);
  });

  it("cookie setAll sets cookies via cookieStore", async () => {
    await sut();
    const callArgs = vi.mocked(createServerClient).mock.calls[0][2];
    callArgs?.cookies?.setAll([
      { name: "sb-auth", value: "token", options: { path: "/" } },
    ]);
    expect(mockCookieStore.set).toHaveBeenCalledWith("sb-auth", "token", {
      path: "/",
    });
  });
});
