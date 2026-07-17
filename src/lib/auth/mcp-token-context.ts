import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

import { AppError } from "@/lib/errors/app-error";
import type { ApiTokenScope } from "@/features/auth/services/api-token-service";

export type McpTokenContext = {
  userId: string;
  tokenId: string;
  scopes: ApiTokenScope[];
};

const storage = new AsyncLocalStorage<McpTokenContext>();

export function runWithMcpTokenContext<T>(
  context: McpTokenContext,
  callback: () => T,
) {
  return storage.run(context, callback);
}

export function requireMcpTokenContext(requiredScope: ApiTokenScope) {
  const context = storage.getStore();
  if (!context) {
    throw new AppError("UNAUTHORIZED", "MCPリクエストの認証情報がありません。", 401);
  }
  if (requiredScope === "write" && !context.scopes.includes("write")) {
    throw new AppError("FORBIDDEN", "このAPIトークンには書き込み権限がありません。", 403);
  }
  return context;
}
