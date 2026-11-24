import { timingSafeEqual } from "node:crypto";

import { getDb } from "@/lib/db";

import {
  hasApiKeyFormat,
  hashIntegrationToken,
  ledgerScopes,
  verifyApiKey,
  type IntegrationScope,
} from "./api-keys";
import { errorResponse } from "./responses";

export type { IntegrationScope } from "./api-keys";

const tokenEnvironment: Record<IntegrationScope, string> = {
  read: "RULETRADE_READ_TOKEN",
  write: "RULETRADE_WRITE_TOKEN",
};

/**
 * Returns a response when the scope is disabled or authentication fails.
 * A null result means the request may proceed with the given scope.
 */
export function authorizeIntegrationRequest(
  request: Request,
  scope: IntegrationScope,
): Response | null {
  const configuredToken = process.env[tokenEnvironment[scope]];
  const hasStaticToken = Boolean(configuredToken?.trim());
  const hasEnabledScope = process.env.RULETRADE_OAUTH_SCOPES?.split(
    /[\s,]+/,
  ).includes(ledgerScopes[scope]);
  if (!hasStaticToken && !hasEnabledScope) {
    return errorResponse("not_found");
  }

  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(\S+)\s*$/i);
  if (!match) return errorResponse("unauthorized");

  const token = match[1];
  const tokenHash = hashIntegrationToken(token);
  if (
    configuredToken &&
    hasStaticToken &&
    timingSafeEqual(tokenHash, hashIntegrationToken(configuredToken))
  ) {
    return null;
  }
  if (hasApiKeyFormat(token)) {
    try {
      if (verifyApiKey(getDb(), tokenHash, scope)) return null;
    } catch {
      return errorResponse("internal_error");
    }
  }
  return errorResponse("unauthorized");
}

export function createMethodNotAllowedHandler(scope: IntegrationScope) {
  return function methodNotAllowed(request: Request): Response {
    const authError = authorizeIntegrationRequest(request, scope);
    return authError ?? errorResponse("method_not_allowed");
  };
}
