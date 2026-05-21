import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicSupabaseEnv } from "@/lib/db/env";
import { createSqliteClient } from "@/lib/db/sqlite-client";

export async function createClient(): Promise<any> {
  if (process.env.DB_PROVIDER !== "supabase") {
    return createSqliteClient();
  }

  const cookieStore = await cookies();
  const { supabaseUrl, supabaseAnonKey } = getPublicSupabaseEnv();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
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
  }) as any;
}
