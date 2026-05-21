import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createSqliteClient } from "@/lib/db/sqlite-client";

export function createAdminClient(): any {
  if (process.env.DB_PROVIDER !== "supabase") {
    return createSqliteClient();
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
  }) as any;
}
