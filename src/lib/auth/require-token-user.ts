import "server-only";

import {
  API_TOKEN_PREFIX,
  findApiTokenByHash,
  hashApiToken,
  parseApiTokenScopes,
  touchApiToken,
  type ApiTokenScope,
} from "@/features/auth/services/api-token-service";
import { checkRateLimit } from "@/lib/rate-limit/check-rate-limit";
import { incrementRateLimit } from "@/lib/rate-limit/increment-rate-limit";
import { AppError } from "@/lib/errors/app-error";

export async function requireTokenUser(
  request: Request,
  requiredScope: ApiTokenScope,
): Promise<{ userId: string; tokenId: string; scopes: ApiTokenScope[] }> {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!new RegExp(`^${API_TOKEN_PREFIX}[a-f0-9]{64}$`).test(token)) {
    throw new AppError("UNAUTHORIZED", "APIトークンが正しくありません。", 401);
  }

  const row = await findApiTokenByHash(hashApiToken(token));
  if (!row || row.revoked_at) {
    throw new AppError("UNAUTHORIZED", "APIトークンが無効です。", 401);
  }

  if (row.expires_at && Date.parse(String(row.expires_at)) <= Date.now()) {
    throw new AppError("UNAUTHORIZED", "APIトークンの有効期限が切れています。", 401);
  }

  const scopes = parseApiTokenScopes(row.scopes);
  if (requiredScope === "write" && !scopes.includes("write")) {
    throw new AppError("FORBIDDEN", "このAPIトークンには書き込み権限がありません。", 403);
  }

  const rateLimitUserId = `api_token:${row.id}`;
  await checkRateLimit({
    userId: rateLimitUserId,
    key: "api_token_minute",
  });
  await incrementRateLimit({
    userId: rateLimitUserId,
    key: "api_token_minute",
  });
  await touchApiToken(row.id);

  return {
    userId: String(row.user_id),
    tokenId: String(row.id),
    scopes,
  };
}
