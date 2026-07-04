"use client";

import { createBrowserClient } from "@/lib/db/supabase-browser";

export async function signInWithPassword(input: {
  email: string;
  password: string;
}) {
  const supabase = createBrowserClient();

  return supabase.auth.signInWithPassword(input);
}

export async function signInAsGuest() {
  const localGuestResponse = await fetch("/api/auth/guest", {
    method: "POST",
  });

  if (localGuestResponse.ok) {
    return { error: null };
  }

  const supabase = createBrowserClient();

  return supabase.auth.signInAnonymously();
}

export async function signUpWithPassword(input: {
  email: string;
  password: string;
  redirectTo: string;
}) {
  const supabase = createBrowserClient();

  return supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: input.redirectTo,
    },
  });
}

export async function signOut() {
  const supabase = createBrowserClient();

  return supabase.auth.signOut();
}
