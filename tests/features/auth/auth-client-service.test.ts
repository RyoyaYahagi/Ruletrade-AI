import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  signInAsGuest,
  signInWithPassword,
  signOut,
  signUpWithPassword,
} from "@/features/auth/services/auth-client-service";

const mockSignInWithPassword = vi.fn();
const mockSignInAnonymously = vi.fn();
const mockSignUp = vi.fn();
const mockSignOut = vi.fn();
const mockFetch = vi.fn();

vi.mock("@/lib/db/supabase-browser", () => ({
  createBrowserClient: vi.fn(() => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signInAnonymously: mockSignInAnonymously,
      signUp: mockSignUp,
      signOut: mockSignOut,
    },
  })),
}));

describe("auth client service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
  });

  it("signs in with email and password", async () => {
    const response = { error: null };
    mockSignInWithPassword.mockResolvedValueOnce(response);

    await expect(
      signInWithPassword({
        email: "user@example.com",
        password: "password",
      }),
    ).resolves.toBe(response);

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password",
    });
  });

  it("signs in anonymously for guest login", async () => {
    const response = { error: null };
    mockFetch.mockResolvedValueOnce({ ok: false });
    mockSignInAnonymously.mockResolvedValueOnce(response);

    await expect(signInAsGuest()).resolves.toBe(response);

    expect(mockFetch).toHaveBeenCalledWith("/api/auth/guest", {
      method: "POST",
    });
    expect(mockSignInAnonymously).toHaveBeenCalledWith();
  });

  it("uses local guest session when available", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await expect(signInAsGuest()).resolves.toEqual({ error: null });

    expect(mockFetch).toHaveBeenCalledWith("/api/auth/guest", {
      method: "POST",
    });
    expect(mockSignInAnonymously).not.toHaveBeenCalled();
  });

  it("signs up with email redirect", async () => {
    const response = { error: null };
    mockSignUp.mockResolvedValueOnce(response);

    await expect(
      signUpWithPassword({
        email: "user@example.com",
        password: "password",
        redirectTo: "http://localhost:3000/auth/callback",
      }),
    ).resolves.toBe(response);

    expect(mockSignUp).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password",
      options: {
        emailRedirectTo: "http://localhost:3000/auth/callback",
      },
    });
  });

  it("signs out", async () => {
    const response = { error: null };
    mockSignOut.mockResolvedValueOnce(response);

    await expect(signOut()).resolves.toBe(response);

    expect(mockSignOut).toHaveBeenCalledWith();
  });
});
