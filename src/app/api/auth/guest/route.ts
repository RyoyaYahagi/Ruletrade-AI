import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  GUEST_SESSION_COOKIE,
  GUEST_SESSION_COOKIE_VALUE,
} from "@/lib/auth/guest-session";

export async function POST(request: Request) {
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

  const cookieOptions = {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
    sameSite: "lax" as const,
    secure: isProduction,
  };

  const redirectPath = new URL(request.url).searchParams.get("redirect");
  if (redirectPath === "/today") {
    const response = new NextResponse(null, {
      status: 303,
      headers: { Location: "/today" },
    });
    response.cookies.set(
      GUEST_SESSION_COOKIE,
      GUEST_SESSION_COOKIE_VALUE,
      cookieOptions,
    );
    return response;
  }

  const cookieStore = await cookies();
  cookieStore.set(
    GUEST_SESSION_COOKIE,
    GUEST_SESSION_COOKIE_VALUE,
    cookieOptions,
  );

  return Response.json({
    ok: true,
    data: {
      redirectTo: "/today",
    },
  });
}
