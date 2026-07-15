import "server-only";

import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

import { getSqliteDatabase } from "@/lib/db/sqlite-client";
import type { AppUser } from "@/lib/auth/types";

export const AUTH_SESSION_COOKIE = "ruletrade_session";
export const AUTH_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const PASSWORD_KEY_LENGTH = 64;

type AuthRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string | null;
  created_at: string;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validatePassword(password: string) {
  return password.length >= 8;
}

export function createLocalUser(params: { email: string; password: string }) {
  const email = normalizeEmail(params.email);
  const database = getSqliteDatabase();
  const existing = database
    .prepare("select id from auth_credentials where email = ?")
    .get(email);

  if (existing) {
    return {
      user: null,
      error: {
        code: "EMAIL_ALREADY_EXISTS",
        message: "このメールアドレスは既に登録されています。",
      },
    };
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const passwordHash = hashPassword(params.password);

  try {
    database
      .transaction(() => {
        database
          .prepare(
            `insert into app_users (id, email, role, created_at, updated_at)
             values (?, ?, 'user', ?, ?)`,
          )
          .run(id, email, now, now);
        database
          .prepare(
            `insert into auth_credentials (user_id, email, password_hash, created_at)
             values (?, ?, ?, ?)`,
          )
          .run(id, email, passwordHash, now);
      })();
  } catch (error) {
    return {
      user: null,
      error: {
        code: "AUTH_USER_CREATE_FAILED",
        message: "アカウントの作成に失敗しました。",
        cause: error,
      },
    };
  }

  return { user: getUserById(id), error: null };
}

export function authenticateLocalUser(params: {
  email: string;
  password: string;
}) {
  const email = normalizeEmail(params.email);
  const database = getSqliteDatabase();
  const row = database
    .prepare(
      `select u.id, u.email, u.display_name, u.role, u.created_at,
              c.password_hash
         from auth_credentials c
         join app_users u on u.id = c.user_id
        where c.email = ?`,
    )
    .get(email) as (AuthRow & { password_hash: string }) | undefined;

  if (!row || !verifyPassword(params.password, row.password_hash)) {
    return {
      user: null,
      error: {
        code: "INVALID_CREDENTIALS",
        message: "メールアドレスまたはパスワードが正しくありません。",
      },
    };
  }

  return { user: toAppUser(row), error: null };
}

export function createAuthSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + AUTH_SESSION_MAX_AGE_SECONDS * 1000,
  ).toISOString();

  getSqliteDatabase()
    .prepare(
      `insert into auth_sessions (token_hash, user_id, expires_at, created_at)
       values (?, ?, ?, ?)`,
    )
    .run(tokenHash, userId, expiresAt, now.toISOString());

  return token;
}

export function getUserBySessionToken(token: string | undefined) {
  if (!token) return null;

  const database = getSqliteDatabase();
  const now = new Date().toISOString();
  database.prepare("delete from auth_sessions where expires_at <= ?").run(now);

  const row = database
    .prepare(
      `select u.id, u.email, u.display_name, u.role, u.created_at
         from auth_sessions s
         join app_users u on u.id = s.user_id
        where s.token_hash = ?
          and s.expires_at > ?`,
    )
    .get(hashSessionToken(token), now) as AuthRow | undefined;

  return row ? toAppUser(row) : null;
}

export function revokeAuthSession(token: string | undefined) {
  if (!token) return;
  getSqliteDatabase()
    .prepare("delete from auth_sessions where token_hash = ?")
    .run(hashSessionToken(token));
}

export function revokeAllAuthSessions(userId: string) {
  getSqliteDatabase()
    .prepare("delete from auth_sessions where user_id = ?")
    .run(userId);
}

export function deleteLocalAuthUser(userId: string) {
  const database = getSqliteDatabase();
  database.transaction(() => {
    database.prepare("delete from auth_sessions where user_id = ?").run(userId);
    database.prepare("delete from auth_credentials where user_id = ?").run(userId);
  })();
}

function getUserById(userId: string) {
  const row = getSqliteDatabase()
    .prepare(
      "select id, email, display_name, role, created_at from app_users where id = ?",
    )
    .get(userId) as AuthRow | undefined;

  return row ? toAppUser(row) : null;
}

function toAppUser(row: AuthRow): AppUser {
  return {
    id: row.id,
    email: row.email,
    app_metadata: { role: row.role ?? "user", provider: "local" },
    user_metadata: { display_name: row.display_name },
    aud: "authenticated",
    created_at: row.created_at,
  };
}

function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derivedKey = scryptSync(password, salt, PASSWORD_KEY_LENGTH, {
    N: 16_384,
    r: 8,
    p: 1,
  });
  return `scrypt:${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

function verifyPassword(password: string, encodedHash: string) {
  const [, saltHex, hashHex] = encodedHash.split(":");
  if (!saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length, {
    N: 16_384,
    r: 8,
    p: 1,
  });

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
