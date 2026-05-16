"use client";

import { createBrowserClient as _createBrowserClient } from "@supabase/ssr";

import { getPublicSupabaseEnv } from "@/lib/db/env";

export function createBrowserClient() {
  const { supabaseUrl, supabaseAnonKey } = getPublicSupabaseEnv();

  return _createBrowserClient(supabaseUrl, supabaseAnonKey);
}
