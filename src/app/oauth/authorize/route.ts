import { ledgerScopes } from "@/features/integration/api-keys";
import {
  createAuthorizationRequest,
  decideAuthorizationRequest,
  grantLifetimeDays,
} from "@/features/oauth/grants";
import {
  authorizationRedirect,
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
import { checkBrowserWriteRequest } from "@/lib/http/browser-write-request";

const scopeDescriptions: Record<string, string> = {
  [ledgerScopes.read]: "台帳の読み取り",
  [ledgerScopes.write]: "台帳への書き込み",
};

export function GET(request: Request) {
  const client = configuredOAuthClient();
  if (!client) return oauthError("not_found", 404);
  if (request.headers.get("tailscale-user-login") !== client.owner)
    return oauthError("access_denied", 403);
  const issuer = oauthIssuer(request);
  const params = new URL(request.url).searchParams;
  const redirectUri = params.get("redirect_uri");
  if (
    !issuer ||
    !redirectUri ||
    params.get("client_id") !== client.id ||
    !client.redirectUris.includes(redirectUri) ||
    hasDuplicateParameter(params, ["client_id", "redirect_uri", "state"])
  ) {
    return oauthError("invalid_request");
  }

  const state = params.get("state");
  const errorRedirect = (error: string) =>
    authorizationRedirect(redirectUri, state, issuer, { error });
  if (
    hasDuplicateParameter(params, [
      "response_type",
      "scope",
      "code_challenge",
      "code_challenge_method",
    ])
  ) {
    return errorRedirect("invalid_request");
  }
  if (params.get("response_type") !== "code")
    return errorRedirect("unsupported_response_type");
  const codeChallenge = params.get("code_challenge");
  if (
    params.get("code_challenge_method") !== "S256" ||
    !codeChallenge ||
    !/^[A-Za-z0-9_-]{43}$/.test(codeChallenge) ||
    Buffer.from(codeChallenge, "base64url").toString("base64url") !==
      codeChallenge
  ) {
    return errorRedirect("invalid_request");
  }
  if (!validResource(params, issuer)) return errorRedirect("invalid_target");
  const requested = params.get("scope");
  const scopes: string[] = requested
    ? [...new Set(requested.split(" "))]
    : client.scopes.filter((scope) => scope === ledgerScopes.read);
  if (
    !scopes.length ||
    scopes.some((scope) => !client.scopes.some((enabled) => enabled === scope))
  ) {
    return errorRedirect("invalid_scope");
  }

  try {
    const id = createAuthorizationRequest(getDb(), {
      clientId: client.id,
      redirectUri,
      scopes,
      codeChallenge,
      state,
      resource: integrationResource(issuer),
    });
    return consentPage(id, new URL(redirectUri), scopes);
  } catch {
    return oauthError("server_error", 500);
  }
}

export async function POST(request: Request) {
  const client = configuredOAuthClient();
  if (!client) return oauthError("not_found", 404);
  if (
    request.headers.get("tailscale-user-login") !== client.owner ||
    checkBrowserWriteRequest(request)
  ) {
    return oauthError("access_denied", 403);
  }

  const issuer = oauthIssuer(request);
  const form = await readOAuthForm(request);
  const id = form?.get("request_id");
  const decision = form?.get("decision");
  if (
    !issuer ||
    !form ||
    !id ||
    hasDuplicateParameter(form, ["request_id", "decision"]) ||
    (decision !== "approve" && decision !== "deny")
  ) {
    return oauthError("invalid_request");
  }

  try {
    const result = decideAuthorizationRequest(getDb(), {
      id,
      clientId: client.id,
      redirectUris: client.redirectUris,
      resource: integrationResource(issuer),
      enabledScopes: client.scopes,
      selectedScopes: form.getAll("scope"),
      approved: decision === "approve",
    });
    if (result.error) return oauthError(result.error);
    return authorizationRedirect(
      result.redirectUri,
      result.state,
      issuer,
      result.result,
    );
  } catch {
    return oauthError("server_error", 500);
  }
}

function consentPage(id: string, redirect: URL, scopes: string[]) {
  // id is a UUID, redirectHost is a parsed HTTP(S) hostname and port,
  // and scope values and labels come from the fixed list above.
  const options = scopes
    .map(
      (scope) =>
        `<label><input type="checkbox" name="scope" value="${scope}"${scope === ledgerScopes.read ? " checked" : ""}> ${scopeDescriptions[scope]} (${scope})</label>`,
    )
    .join("");
  return new Response(
    `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Muse との接続 | Ruletrade</title>
  <style>
    :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
    main { max-width: 32rem; margin: 3rem auto; padding: 0 1rem; line-height: 1.6; }
    fieldset { border: 1px solid GrayText; border-radius: .75rem; margin: 1.25rem 0; }
    label { display: block; padding: .375rem; }
    button { font: inherit; padding: .4rem .85rem; margin-right: .5rem; }
    dd { margin: 0 0 .5rem; overflow-wrap: anywhere; }
  </style>
</head>
<body>
<main>
  <h1>Muse との接続</h1>
  <dl>
    <dt>戻り先</dt><dd>${redirect.host}</dd>
    <dt>許可の有効期間</dt><dd>${grantLifetimeDays} 日</dd>
  </dl>
  <form method="post" action="/oauth/authorize">
    <input type="hidden" name="request_id" value="${id}">
    <fieldset><legend>許可する操作</legend>${options}</fieldset>
    <button type="submit" name="decision" value="approve">許可する</button>
    <button type="submit" name="decision" value="deny">拒否する</button>
  </form>
</main>
</body>
</html>`,
    {
      headers: {
        ...noStore,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' ${redirect.origin}; frame-ancestors 'none'; base-uri 'none'`,
        // Same-origin form submissions must carry their Origin for the write check.
      "Referrer-Policy": "same-origin",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
