import {
  configuredOAuthClient,
  noStore,
  oauthError,
  oauthIssuer,
} from "@/features/oauth/http";

export function GET(request: Request) {
  const client = configuredOAuthClient();
  if (!client) return oauthError("not_found", 404);
  const issuer = oauthIssuer(request);
  if (!issuer) return oauthError("invalid_request");
  const authenticationMethods = ["client_secret_basic", "client_secret_post"];
  return Response.json(
    {
      issuer,
      authorization_endpoint: issuer + "/oauth/authorize",
      token_endpoint: issuer + "/oauth/token",
      revocation_endpoint: issuer + "/oauth/revoke",
      scopes_supported: client.scopes,
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: authenticationMethods,
      revocation_endpoint_auth_methods_supported: authenticationMethods,
      code_challenge_methods_supported: ["S256"],
      authorization_response_iss_parameter_supported: true,
    },
    { headers: noStore },
  );
}
