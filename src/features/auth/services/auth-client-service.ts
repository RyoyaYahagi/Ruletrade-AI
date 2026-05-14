"use client";

import { createClient } from "@/lib/db/supabase-browser";

export async function signInWithPassword(input: {
  email: string;
  password: string;
}) {
  const supabase = createClient();

  return supabase.auth.signInWithPassword(input);
}

export async function signUpWithPassword(input: {
  email: string;
  password: string;
  redirectTo: string;
}) {
  const supabase = createClient();

  return supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: input.redirectTo,
    },
  });
}

export async function signOut() {
  const supabase = createClient();

  return supabase.auth.signOut();
}
