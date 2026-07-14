import { cookies } from "next/headers";

import {
  AUTH_SESSION_COOKIE,
  AUTH_SESSION_MAX_AGE_SECONDS,
  createAuthSession,
  createLocalUser,
  validatePassword,
} from "@/lib/auth/local-auth";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: unknown;
    password?: unknown;
  };

  if (typeof body.email !== "string" || typeof body.password !== "string") {
    return Response.json(
      { ok: false, error: { code: "INVALID_INPUT", message: "入力内容を確認してください。" } },
      { status: 400 },
    );
  }

  if (!validatePassword(body.password)) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "WEAK_PASSWORD",
          message: "パスワードは8文字以上で入力してください。",
        },
      },
      { status: 400 },
    );
  }

  const result = createLocalUser({
    email: body.email,
    password: body.password,
  });

  if (result.error || !result.user) {
    const status = result.error?.code === "EMAIL_ALREADY_EXISTS" ? 409 : 500;
    return Response.json({ ok: false, error: result.error }, { status });
  }

  const sessionToken = createAuthSession(result.user.id);
  const cookieStore = await cookies();
  cookieStore.set(AUTH_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return Response.json({ ok: true, data: { user: result.user } }, { status: 201 });
}
