import { createHash, timingSafeEqual } from "node:crypto";

import { errorResponse } from "./responses";

export type IntegrationScope = "read" | "write";

const tokenEnvironment: Record<IntegrationScope, string> = {
  read: "RULETRADE_READ_TOKEN",
  write: "RULETRADE_WRITE_TOKEN",
};

function hashToken(token: string): Buffer {
  return createHash("sha256").update(token, "utf8").digest();
}

/**
 * Returns a response when the scope is disabled or authentication fails.
 * A null result means the request may proceed with the given scope.
 */
export function authorizeIntegrationRequest(
  request: Request,
  scope: IntegrationScope,
): Response | null {
  const configuredToken = process.env[tokenEnvironment[scope]];
  if (!configuredToken || configuredToken.trim().length === 0) {
    return errorResponse("not_found");
  }

  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(\S+)\s*$/i);
  if (!match) return errorResponse("unauthorized");

  return timingSafeEqual(hashToken(match[1]), hashToken(configuredToken))
    ? null
    : errorResponse("unauthorized");
}

export function createMethodNotAllowedHandler(scope: IntegrationScope) {
  return function methodNotAllowed(request: Request): Response {
    const authError = authorizeIntegrationRequest(request, scope);
    return authError ?? errorResponse("method_not_allowed");
  };
}
