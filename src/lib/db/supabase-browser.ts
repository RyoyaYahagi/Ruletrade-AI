"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getPublicSupabaseEnv } from "@/lib/db/env";

export function createClient() {
  const { supabaseUrl, supabaseAnonKey } = getPublicSupabaseEnv();

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
