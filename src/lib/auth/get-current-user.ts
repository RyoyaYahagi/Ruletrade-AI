import "server-only";

import { createClient } from "@/lib/db/supabase-server";

export async function getCurrentUser() {
  let supabase;

  try {
    supabase = await createClient();
  } catch (err) {
    console.error("Failed to create supabase client:", err);
    return null;
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return user;
}
