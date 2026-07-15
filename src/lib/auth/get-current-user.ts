import "server-only";

import { cookies } from "next/headers";

import {
  AUTH_SESSION_COOKIE,
  getUserBySessionToken,
} from "@/lib/auth/local-auth";
import {
  createGuestUser,
  GUEST_SESSION_COOKIE,
  GUEST_SESSION_COOKIE_VALUE,
} from "@/lib/auth/guest-session";
import type { AppUser } from "@/lib/auth/types";
import { logWarn } from "@/lib/observability/structured-logger";

const MOCK_AUTH_EMAIL = process.env.MOCK_AUTH_EMAIL;
const MOCK_AUTH_USER_ID = process.env.MOCK_AUTH_USER_ID ?? "mock-user-id";
const E2E_TEST_AUTH_ENABLED = process.env.E2E_TEST_AUTH === "true";
const MOCK_AUTH_ALLOWED =
  E2E_TEST_AUTH_ENABLED &&
  (process.env.NODE_ENV !== "production" || process.env.CI === "true");

export async function getCurrentUser(): Promise<AppUser | null> {
  if (MOCK_AUTH_EMAIL && MOCK_AUTH_ALLOWED) {
    return {
      id: MOCK_AUTH_USER_ID,
      email: MOCK_AUTH_EMAIL,
      app_metadata: { role: process.env.MOCK_AUTH_ROLE ?? "user" },
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    };
  }

  const cookieStore = await cookies();

  if (process.env.NODE_ENV !== "production") {
    if (
      cookieStore.get(GUEST_SESSION_COOKIE)?.value ===
      GUEST_SESSION_COOKIE_VALUE
    ) {
      return createGuestUser();
    }
  }

  try {
    return getUserBySessionToken(cookieStore.get(AUTH_SESSION_COOKIE)?.value);
  } catch {
    logWarn("Failed to read local auth session");
    return null;
  }
}
