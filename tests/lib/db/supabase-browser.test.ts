import { describe, expect, it, vi, beforeEach } from "vitest";
import { createClient } from "@/lib/db/supabase-browser";

vi.mock("@/lib/db/env", () => ({
  getPublicSupabaseEnv: vi.fn(() => ({
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "anon-key",
  })),
}));

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn(() => ({ mockBrowserClient: true })),
}));

import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseEnv } from "@/lib/db/env";

describe("createClient (browser)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates browser client with public env", () => {
    const client = createClient();
    expect(getPublicSupabaseEnv).toHaveBeenCalled();
    expect(createBrowserClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "anon-key",
    );
    expect(client).toEqual({ mockBrowserClient: true });
  });
});
