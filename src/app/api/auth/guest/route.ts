import { cookies } from "next/headers";

import {
  GUEST_SESSION_COOKIE,
  GUEST_SESSION_COOKIE_VALUE,
} from "@/lib/auth/guest-session";
import { getDatabaseProvider } from "@/lib/db/provider";

export async function POST() {
  if (process.env.NODE_ENV === "production" || getDatabaseProvider() !== "sqlite") {
    return Response.json(
      {
        ok: false,
        error: {
          code: "GUEST_AUTH_UNAVAILABLE",
          message: "この環境ではゲストログインを利用できません。",
        },
      },
      { status: 409 },
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(GUEST_SESSION_COOKIE, GUEST_SESSION_COOKIE_VALUE, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
    sameSite: "lax",
  });

  return Response.json({
    ok: true,
    data: {
      redirectTo: "/dashboard",
    },
  });
}
