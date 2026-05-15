import "server-only";

import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/db/supabase-server";

function createMockUser(): User {
  const now = new Date().toISOString();
  return {
    id: "mock-user-id",
    aud: "authenticated",
    role: "authenticated",
    email: "mock@example.com",
    email_confirmed_at: now,
    phone: "",
    confirmation_sent_at: now,
    confirmed_at: now,
    last_sign_in_at: now,
    app_metadata: {
      provider: "email",
      providers: ["email"],
      role: "admin",
    },
    user_metadata: {
      name: "Mock User",
    },
    identities: [],
    created_at: now,
    updated_at: now,
    is_anonymous: false,
  } as User;
}

export async function getCurrentUser() {
  if (process.env.MOCK_AUTH === "true") {
    return createMockUser();
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
