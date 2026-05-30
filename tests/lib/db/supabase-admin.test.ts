import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createAdminClient } from "@/lib/db/supabase-admin";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ mockAdminClient: true })),
}));

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

describe("createAdminClient", () => {
  beforeEach(() => {
    vi.stubEnv("DB_PROVIDER", "supabase");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("creates client with correct env vars and auth options", () => {
    const client = createAdminClient();
    expect(createSupabaseClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "service-role-key",
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    expect(client).toEqual({ mockAdminClient: true });
  });

  it("throws when SUPABASE_SERVICE_ROLE_KEY is missing", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(() => createAdminClient()).toThrow(
      "Missing Supabase admin environment variables",
    );
  });

  it("throws when NEXT_PUBLIC_SUPABASE_URL is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(() => createAdminClient()).toThrow(
      "Missing Supabase admin environment variables",
    );
  });

  it("throws when both env vars are missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(() => createAdminClient()).toThrow(
      "Missing Supabase admin environment variables",
    );
  });
});
