"use client";

type AuthResponse = {
  ok?: boolean;
  data?: unknown;
  error?: { code?: string; message?: string } | null;
};

export async function signInWithPassword(input: {
  email: string;
  password: string;
}) {
  return postAuthRequest("/api/auth/login", input);
}

export async function signInAsGuest() {
  return postAuthRequest("/api/auth/guest");
}

export async function signUpWithPassword(input: {
  email: string;
  password: string;
}) {
  return postAuthRequest("/api/auth/signup", input);
}

export async function signOut() {
  return postAuthRequest("/api/auth/logout");
}

async function postAuthRequest(path: string, body?: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const json = (await response.json()) as AuthResponse;
  if (response.ok && json.ok !== false) {
    return { data: json.data, error: null };
  }

  return {
    data: json.data,
    error: json.error ?? { message: "認証処理に失敗しました。" },
  };
}
