import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getDatabaseProvider } from "@/lib/db/provider";
import { createSqliteClient } from "@/lib/db/sqlite-client";

type AppSupabaseClient = SupabaseClient;

export function createAdminClient(): AppSupabaseClient {
  if (getDatabaseProvider() === "sqlite") {
    return createSqliteClient() as unknown as AppSupabaseClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables");
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
