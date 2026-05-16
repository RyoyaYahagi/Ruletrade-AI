import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  getOptionalPublicSupabaseEnv,
  getPublicSupabaseEnv,
} from "@/lib/db/env";

describe("getOptionalPublicSupabaseEnv", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns env when both variables are set", () => {
    const result = getOptionalPublicSupabaseEnv();
    expect(result).toEqual({
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon-key",
    });
  });

  it("returns null when SUPABASE_URL is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const result = getOptionalPublicSupabaseEnv();
    expect(result).toBeNull();
  });

  it("returns null when SUPABASE_ANON_KEY is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const result = getOptionalPublicSupabaseEnv();
    expect(result).toBeNull();
  });

  it("returns null when both are missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const result = getOptionalPublicSupabaseEnv();
    expect(result).toBeNull();
  });
});

describe("getPublicSupabaseEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns env when both variables are set", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    const result = getPublicSupabaseEnv();
    expect(result).toEqual({
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon-key",
    });
  });

  it("throws when variables are missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(() => getPublicSupabaseEnv()).toThrow(
      "Missing public Supabase environment variables",
    );
  });
});
