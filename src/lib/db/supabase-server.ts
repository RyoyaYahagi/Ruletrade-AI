import "server-only";

import { createServerClient as _createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { getPublicSupabaseEnv } from "@/lib/db/env";
import { getDatabaseProvider } from "@/lib/db/provider";
import { createSqliteClient } from "@/lib/db/sqlite-client";

type AppSupabaseClient = SupabaseClient;

export async function createServerClient(): Promise<AppSupabaseClient> {
  if (getDatabaseProvider() === "sqlite") {
    return createSqliteClient() as unknown as AppSupabaseClient;
  }

  const cookieStore = await cookies();
  const { supabaseUrl, supabaseAnonKey } = getPublicSupabaseEnv();

  return _createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
}
