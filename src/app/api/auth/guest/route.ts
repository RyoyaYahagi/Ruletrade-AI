import { cookies } from "next/headers";

import {
  GUEST_SESSION_COOKIE,
  GUEST_SESSION_COOKIE_VALUE,
} from "@/lib/auth/guest-session";

export async function POST() {
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
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
    secure: isProduction,
  });

  return Response.json({
    ok: true,
    data: {
      redirectTo: "/dashboard",
    },
  });
}
