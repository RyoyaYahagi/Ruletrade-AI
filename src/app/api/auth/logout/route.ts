import { cookies } from "next/headers";

import {
  AUTH_SESSION_COOKIE,
  revokeAuthSession,
} from "@/lib/auth/local-auth";

export async function POST() {
  const cookieStore = await cookies();
  revokeAuthSession(cookieStore.get(AUTH_SESSION_COOKIE)?.value);
  cookieStore.delete(AUTH_SESSION_COOKIE);
  cookieStore.delete("ruletrade_guest_session");

  return Response.json({ ok: true });
}
