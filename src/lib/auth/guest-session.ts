import type { User } from "@supabase/supabase-js";

export const GUEST_SESSION_COOKIE = "ruletrade_guest_session";
export const GUEST_SESSION_COOKIE_VALUE = "guest";
export const GUEST_USER_ID = "guest-user";
export const GUEST_USER_EMAIL = "guest@ruletrade.local";

export function createGuestUser(): User {
  return {
    id: GUEST_USER_ID,
    email: GUEST_USER_EMAIL,
    app_metadata: { role: "user", provider: "guest" },
    user_metadata: { display_name: "ゲスト" },
    aud: "authenticated",
    created_at: new Date().toISOString(),
  } as unknown as User;
}
