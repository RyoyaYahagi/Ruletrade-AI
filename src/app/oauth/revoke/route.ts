import { revokeOAuthToken } from "@/features/oauth/grants";
import {
  clientAuthenticationError,
  configuredOAuthClient,
  hasDuplicateParameter,
  noStore,
  oauthError,
  readOAuthForm,
} from "@/features/oauth/http";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  const client = configuredOAuthClient();
  if (!client) return oauthError("not_found", 404);
  const form = await readOAuthForm(request);
  const token = form?.get("token");
  if (
    !form ||
    !token ||
    hasDuplicateParameter(form, ["token", "token_type_hint"])
  )
    return oauthError("invalid_request");
  const authenticationError = clientAuthenticationError(request, form, client);
  if (authenticationError) return authenticationError;

  try {
    revokeOAuthToken(getDb(), client.id, token);
    return new Response(null, { status: 200, headers: noStore });
  } catch {
    return oauthError("server_error", 500);
  }
}
