import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";

import { createDatabaseClient } from "@/lib/db/database-client";
import { AppError } from "@/lib/errors/app-error";

export const API_TOKEN_PREFIX = "rta_";
export const MAX_ACTIVE_API_TOKENS = 5;

export type ApiTokenScope = "read" | "write";

export function hashApiToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function parseApiTokenScopes(value: unknown): ApiTokenScope[] {
  const scopes = String(value ?? "read")
    .split(",")
    .map((scope) => scope.trim())
    .filter((scope): scope is ApiTokenScope =>
      scope === "read" || scope === "write",
    );

  return scopes.includes("write") ? ["read", "write"] : ["read"];
}

export async function createApiToken(params: {
  userId: string;
  label: string;
  scopes: "read" | "read,write";
  expiresInDays?: number;
}) {
  const db = await createDatabaseClient();
  const { data: existing, error: existingError } = await db
    .from("api_access_tokens")
    .select("id, revoked_at, expires_at")
    .eq("user_id", params.userId);

  if (existingError) {
    throw new AppError(
      "DATABASE_ERROR",
      "APIトークンの上限を確認できませんでした。",
      500,
      existingError,
    );
  }

  const now = Date.now();
  const activeCount = (existing ?? []).filter((row: Record<string, unknown>) => {
    if (row.revoked_at) return false;
    if (!row.expires_at) return true;
    return Date.parse(String(row.expires_at)) > now;
  }).length;

  if (activeCount >= MAX_ACTIVE_API_TOKENS) {
    throw new AppError(
      "VALIDATION_ERROR",
      `有効なAPIトークンは${MAX_ACTIVE_API_TOKENS}個まで発行できます。`,
      400,
    );
  }

  const token = `${API_TOKEN_PREFIX}${randomBytes(32).toString("hex")}`;
  const tokenId = randomUUID();
  const expiresAt = params.expiresInDays
    ? new Date(now + params.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { error } = await db.from("api_access_tokens").insert({
    id: tokenId,
    user_id: params.userId,
    token_hash: hashApiToken(token),
    label: params.label.trim(),
    scopes: params.scopes,
    expires_at: expiresAt,
  });

  if (error) {
    throw new AppError("DATABASE_ERROR", "APIトークンを発行できませんでした。", 500, error);
  }

  return { token, tokenId };
}

export async function listApiTokens(params: { userId: string }) {
  const db = await createDatabaseClient();
  const { data, error } = await db
    .from("api_access_tokens")
    .select("id, label, scopes, last_used_at, expires_at, revoked_at, created_at")
    .eq("user_id", params.userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new AppError("DATABASE_ERROR", "APIトークン一覧を取得できませんでした。", 500, error);
  }

  return { tokens: data ?? [] };
}

export async function revokeApiToken(params: {
  userId: string;
  tokenId: string;
}) {
  const db = await createDatabaseClient();
  const { data: token, error: findError } = await db
    .from("api_access_tokens")
    .select("id")
    .eq("id", params.tokenId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (findError || !token) {
    throw new AppError("NOT_FOUND", "APIトークンが見つかりません。", 404, findError);
  }

  const { error } = await db
    .from("api_access_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", params.tokenId)
    .eq("user_id", params.userId);

  if (error) {
    throw new AppError("DATABASE_ERROR", "APIトークンを失効できませんでした。", 500, error);
  }

  return { tokenId: params.tokenId, revoked: true };
}

export async function findApiTokenByHash(tokenHash: string) {
  const db = await createDatabaseClient();
  const { data, error } = await db
    .from("api_access_tokens")
    .select("id, user_id, scopes, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    throw new AppError("DATABASE_ERROR", "APIトークンを検証できませんでした。", 500, error);
  }

  return data;
}

export async function touchApiToken(tokenId: string) {
  const db = await createDatabaseClient();
  const { error } = await db
    .from("api_access_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", tokenId);

  if (error) {
    throw new AppError("DATABASE_ERROR", "APIトークンの利用日時を更新できませんでした。", 500, error);
  }
}

export async function recordApiToolAudit(params: {
  userId: string;
  tokenId: string;
  toolName: string;
  status: "success" | "error";
  latencyMs: number;
}) {
  const db = await createDatabaseClient();
  const { error } = await db.from("api_tool_audit_logs").insert({
    id: randomUUID(),
    user_id: params.userId,
    token_id: params.tokenId,
    tool_name: params.toolName,
    status: params.status,
    latency_ms: params.latencyMs,
  });

  if (error) {
    throw new AppError("DATABASE_ERROR", "APIツール監査ログを保存できませんでした。", 500, error);
  }
}
