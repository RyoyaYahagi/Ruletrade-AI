import "server-only";

import { cookies } from "next/headers";

import {
  createGuestUser,
  GUEST_SESSION_COOKIE,
  GUEST_SESSION_COOKIE_VALUE,
} from "@/lib/auth/guest-session";
import { createServerClient } from "@/lib/db/supabase-server";

const MOCK_AUTH_EMAIL = process.env.MOCK_AUTH_EMAIL;
const MOCK_AUTH_USER_ID = process.env.MOCK_AUTH_USER_ID ?? "mock-user-id";

export async function getCurrentUser() {
  // Development mock: return mock user without hitting Supabase
  // NEVER use in production — guard ensures this is safe
  if (MOCK_AUTH_EMAIL && process.env.NODE_ENV !== "production") {
    return {
      id: MOCK_AUTH_USER_ID,
      email: MOCK_AUTH_EMAIL,
      app_metadata: { role: process.env.MOCK_AUTH_ROLE ?? "user" },
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    } as unknown as import("@supabase/supabase-js").User;
  }

  if (process.env.NODE_ENV !== "production") {
    const cookieStore = await cookies();
    if (cookieStore.get(GUEST_SESSION_COOKIE)?.value === GUEST_SESSION_COOKIE_VALUE) {
      return createGuestUser();
    }
  }

  let supabase;

  try {
    supabase = await createServerClient();
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
