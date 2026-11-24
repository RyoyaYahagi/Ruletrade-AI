import {
  exchangeAuthorizationCode,
  rotateRefreshToken,
} from "@/features/oauth/grants";
import {
  clientAuthenticationError,
  configuredOAuthClient,
  hasDuplicateParameter,
  integrationResource,
  noStore,
  oauthError,
  oauthIssuer,
  readOAuthForm,
  validResource,
} from "@/features/oauth/http";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  const client = configuredOAuthClient();
  if (!client) return oauthError("not_found", 404);
  const form = await readOAuthForm(request);
  if (
    !form ||
    hasDuplicateParameter(form, [
      "grant_type",
      "code",
      "redirect_uri",
      "code_verifier",
      "refresh_token",
      "scope",
    ])
  ) {
    return oauthError("invalid_request");
  }
  const authenticationError = clientAuthenticationError(request, form, client);
  if (authenticationError) return authenticationError;
  const issuer = oauthIssuer(request);
  if (!issuer) return oauthError("invalid_request");
  if (!validResource(form, issuer)) return oauthError("invalid_target");

  const resource = integrationResource(issuer);
  const grantType = form.get("grant_type");
  try {
    if (grantType === "authorization_code") {
      const code = form.get("code");
      const redirectUri = form.get("redirect_uri");
      const verifier = form.get("code_verifier");
      if (!code || !redirectUri || !verifier)
        return oauthError("invalid_request");
      if (!client.redirectUris.includes(redirectUri))
        return oauthError("invalid_grant");
      const result = exchangeAuthorizationCode(getDb(), {
        clientId: client.id,
        code,
        redirectUri,
        verifier,
        resource,
      });
      return result.error
        ? oauthError(result.error)
        : Response.json(result.tokens, { headers: noStore });
    }
    if (grantType === "refresh_token") {
      const refresh = form.get("refresh_token");
      if (!refresh) return oauthError("invalid_request");
      const result = rotateRefreshToken(
        getDb(),
        client.id,
        refresh,
        resource,
        form.get("scope"),
      );
      return result.error
        ? oauthError(result.error)
        : Response.json(result.tokens, { headers: noStore });
    }
    return oauthError(grantType ? "unsupported_grant_type" : "invalid_request");
  } catch {
    return oauthError("server_error", 500);
  }
}
