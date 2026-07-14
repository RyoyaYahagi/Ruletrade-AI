import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  signInAsGuest,
  signInWithPassword,
  signOut,
  signUpWithPassword,
} from "@/features/auth/services/auth-client-service";

const mockFetch = vi.fn();

vi.stubGlobal("fetch", mockFetch);

describe("auth client service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signs in with email and password through the local API", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({ ok: true, data: { user: { id: "user-1" } } }),
    });

    await expect(
      signInWithPassword({ email: "user@example.com", password: "password123" }),
    ).resolves.toMatchObject({ error: null });

    expect(mockFetch).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", password: "password123" }),
    });
  });

  it("uses the local guest session endpoint", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({ ok: true }),
    });

    await expect(signInAsGuest()).resolves.toMatchObject({ error: null });
    expect(mockFetch).toHaveBeenCalledWith("/api/auth/guest", {
      method: "POST",
      headers: undefined,
      body: undefined,
    });
  });

  it("signs up through the local API", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({ ok: true, data: { user: { id: "user-1" } } }),
    });

    await expect(
      signUpWithPassword({ email: "user@example.com", password: "password123" }),
    ).resolves.toMatchObject({ error: null });

    expect(mockFetch).toHaveBeenCalledWith("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", password: "password123" }),
    });
  });

  it("signs out through the local API", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({ ok: true }),
    });

    await expect(signOut()).resolves.toMatchObject({ error: null });
    expect(mockFetch).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
      headers: undefined,
      body: undefined,
    });
  });
});
