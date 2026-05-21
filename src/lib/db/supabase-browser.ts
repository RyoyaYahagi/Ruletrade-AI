"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createBrowserClient } from "@supabase/ssr";

import { getPublicSupabaseEnv } from "@/lib/db/env";

export function createClient(): any {
  if (process.env.NEXT_PUBLIC_DB_PROVIDER !== "supabase") {
    return {
      auth: {
        async signInWithPassword() {
          return { data: { user: null, session: null }, error: null };
        },
        async signInAnonymously() {
          return { data: { user: null, session: null }, error: null };
        },
        async signUp() {
          return { data: { user: null, session: null }, error: null };
        },
        async signOut() {
          return { error: null };
        },
      },
    };
  }

  const { supabaseUrl, supabaseAnonKey } = getPublicSupabaseEnv();

  return createBrowserClient(
    supabaseUrl,
    supabaseAnonKey,
  ) as any;
}
