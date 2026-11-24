import { timingSafeEqual } from "node:crypto";

import {
  hashIntegrationToken,
  ledgerScopes,
} from "@/features/integration/api-keys";

const authorizationResponseParameters = [
  "code",
  "error",
  "error_description",
  "error_uri",
  "state",
  "iss",
];

export function configuredOAuthClient() {
  const id = process.env.RULETRADE_OAUTH_CLIENT_ID;
  const secretHash = process.env.RULETRADE_OAUTH_CLIENT_SECRET_HASH;
  const owner = process.env.RULETRADE_OAUTH_OWNER_LOGIN;
  const redirectUris =
    process.env.RULETRADE_OAUTH_REDIRECT_URIS?.trim().split(/[\s,]+/);
  if (
    !id?.trim() ||
    !secretHash ||
    !/^[a-f0-9]{64}$/i.test(secretHash) ||
    !owner?.trim() ||
    !redirectUris?.length
  )
    return null;
  if (
    !redirectUris.every((uri) => {
      if (uri.includes("#") || !URL.canParse(uri)) return false;
      const parsed = new URL(uri);
      return (
        ["https:", "http:"].includes(parsed.protocol) &&
        !parsed.username &&
        !parsed.password &&
        (parsed.protocol === "https:" || isLoopback(parsed.hostname)) &&
        !authorizationResponseParameters.some((name) =>
          parsed.searchParams.has(name),
        )
      );
    })
  )
    return null;

  const enabledScopes =
    process.env.RULETRADE_OAUTH_SCOPES?.split(/[\s,]+/) ?? [];
  return {
    id,
    secretHash: Buffer.from(secretHash, "hex"),
    owner,
    redirectUris,
    scopes: Object.values(ledgerScopes).filter((scope) =>
      enabledScopes.includes(scope),
    ),
  };
}
export type OAuthClient = NonNullable<ReturnType<typeof configuredOAuthClient>>;

function isLoopback(hostname: string) {
  return ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
}

export function oauthIssuer(request: Request): string | null {
  const url = new URL(request.url);
  // Serve sets these headers at the HTTPS boundary. The backend listens on loopback.
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    url.host;
  const protocol =
    request.headers.get("x-forwarded-proto") ?? url.protocol.slice(0, -1);
  if (
    !/^(?:[a-z0-9.-]+|\[::1\])(?::[0-9]+)?$/i.test(host) ||
    !["http", "https"].includes(protocol)
  )
    return null;
  const origin = `${protocol}://${host}`;
  if (!URL.canParse(origin)) return null;
  const parsed = new URL(origin);
  return protocol === "https" || isLoopback(parsed.hostname)
    ? parsed.origin
    : null;
}

export function integrationResource(issuer: string) {
  return issuer + "/api/integration/v1";
}

export function validResource(params: URLSearchParams, issuer: string) {
  const resources = params.getAll("resource");
  return (
    resources.length === 0 ||
    (resources.length === 1 && resources[0] === integrationResource(issuer))
  );
}

export const noStore = { "Cache-Control": "no-store", Pragma: "no-cache" };

export function oauthError(error: string, status = 400, authenticate?: string) {
  const headers = new Headers(noStore);
  if (authenticate) headers.set("WWW-Authenticate", authenticate);
  return Response.json({ error }, { status, headers });
}

export function authorizationRedirect(
  uri: string,
  state: string | null,
  issuer: string,
  result: { code: string } | { error: string },
) {
  const redirect = new URL(uri);
  const responseParams = new URLSearchParams(result);
  if (state !== null) responseParams.set("state", state);
  responseParams.set("iss", issuer);
  const separator = redirect.search ? "&" : "?";
  redirect.search += separator + responseParams.toString();
  return new Response(null, {
    status: 303,
    headers: {
      ...noStore,
      Location: redirect.href,
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function readOAuthForm(request: Request) {
  const contentType = request.headers
    .get("content-type")
    ?.split(";")[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/x-www-form-urlencoded") return null;
  try {
    return new URLSearchParams(await request.text());
  } catch {
    return null;
  }
}

export function hasDuplicateParameter(
  params: URLSearchParams,
  names: string[],
) {
  return names.some((name) => params.getAll(name).length > 1);
}

export function clientAuthenticationError(
  request: Request,
  params: URLSearchParams,
  client: OAuthClient,
) {
  if (hasDuplicateParameter(params, ["client_id", "client_secret"]))
    return oauthError("invalid_request");
  const authorization = request.headers.get("authorization");
  let id = params.get("client_id");
  let secret = params.get("client_secret");
  if (authorization !== null) {
    if (id !== null || secret !== null) return oauthError("invalid_request");
    const basic = authorization.match(/^Basic\s+([A-Za-z0-9+/]+=*)$/i);
    const invalidBasic = () =>
      oauthError("invalid_client", 401, 'Basic realm="Ruletrade-AI"');
    if (!basic) return invalidBasic();
    const credentials = Buffer.from(basic[1], "base64").toString("utf8");
    const separator = credentials.indexOf(":");
    if (separator < 0) return invalidBasic();
    try {
      id = decodeURIComponent(
        credentials.slice(0, separator).replaceAll("+", " "),
      );
      secret = decodeURIComponent(
        credentials.slice(separator + 1).replaceAll("+", " "),
      );
    } catch {
      return invalidBasic();
    }
  }
  if (
    id === client.id &&
    secret &&
    timingSafeEqual(hashIntegrationToken(secret), client.secretHash)
  )
    return null;
  return authorization === null
    ? oauthError("invalid_client")
    : oauthError("invalid_client", 401, 'Basic realm="Ruletrade-AI"');
}
