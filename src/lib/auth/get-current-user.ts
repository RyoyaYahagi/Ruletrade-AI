import "server-only";

import { createClient } from "@/lib/db/supabase-server";

const MOCK_AUTH_EMAIL = process.env.MOCK_AUTH_EMAIL;
const MOCK_AUTH_USER_ID = process.env.MOCK_AUTH_USER_ID ?? "mock-user-id";

export async function getCurrentUser() {
  // Development mock: return mock user without hitting Supabase
  if (MOCK_AUTH_EMAIL) {
    return {
      id: MOCK_AUTH_USER_ID,
      email: MOCK_AUTH_EMAIL,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    } as unknown as import("@supabase/supabase-js").User;
  }

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
