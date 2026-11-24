import { createHash, randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";

import { GET as discover } from "@/app/.well-known/oauth-authorization-server/route";
import { GET as exportJson } from "@/app/api/export/route";
import { POST as capture } from "@/app/api/integration/v1/captures/route";
import { GET as status } from "@/app/api/integration/v1/status/route";
import { POST as uiRevoke } from "@/app/more/connections/revoke/route";
import { GET as authorize, POST as approve } from "@/app/oauth/authorize/route";
import { POST as revoke } from "@/app/oauth/revoke/route";
import { POST as exchange } from "@/app/oauth/token/route";
import { issueApiKey } from "@/features/integration/api-keys";
import { importJson } from "@/features/json-import/service";
import { getDb } from "@/lib/db";
import {
  integrationGrants,
  integrationTokens,
  oauthAuthRequests,
} from "@/lib/db/schema";

const directory = mkdtempSync(path.join(os.tmpdir(), "ruletrade-oauth-"));
const origin = "https://ruletrade.example.test:9445";
const redirect = "https://muse.example.test/callback?from=ruletrade";
const resource = origin + "/api/integration/v1";
const owner = "owner@example.test";
const clientId = "muse+test";
const dummySecret = "test only: 測定+";
const verifier = randomBytes(32).toString("base64url");
const hash = (value: string) => createHash("sha256").update(value);
const state = "値+&=/ test";
const scopes = "ledger:read ledger:write";
const day = 86_400_000;

const credentials = { client_id: clientId, client_secret: dummySecret };
const basic =
  "Basic " +
  Buffer.from(
    [clientId, dummySecret]
      .map((part) => new URLSearchParams({ v: part }).toString().slice(2))
      .join(":"),
  ).toString("base64");

function authorizeRequest(
  overrides: Record<string, string | null> = {},
  login: string | null = owner,
) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: "code",
    code_challenge_method: "S256",
    code_challenge: hash(verifier).digest("base64url"),
    state,
    scope: scopes,
    resource,
  });
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  return new Request(origin + "/oauth/authorize?" + params, {
    headers: login ? { "Tailscale-User-Login": login } : {},
  });
}

function post(
  pathname: string,
  fields: Record<string, string> | [string, string][],
  headers: Record<string, string> = {},
) {
  return new Request(origin + pathname, {
    method: "POST",
    body: new URLSearchParams(fields),
    headers,
  });
}

function consent(
  id: string,
  selected = ["ledger:read"],
  headers: Record<string, string> = {},
) {
  return approve(
    post(
      "/oauth/authorize",
      [
        ["request_id", id],
        ["decision", "approve"],
        ...selected.map((scope): [string, string] => ["scope", scope]),
      ],
      { "Tailscale-User-Login": owner, Origin: origin, ...headers },
    ),
  );
}

async function pendingRequest(overrides?: Record<string, string | null>) {
  const response = authorize(authorizeRequest(overrides));
  expect(response.status).toBe(200);
  const html = await response.text();
  const id = html.match(/name="request_id" value="([^"]+)"/)?.[1];
  expect(id).toBeTruthy();
  return { id: id!, html };
}

async function issueCode(selected?: string[]) {
  const { id } = await pendingRequest();
  const response = await consent(id, selected);
  expect(response.status).toBe(303);
  const callback = new URL(response.headers.get("location")!);
  expect(callback.origin + callback.pathname).toBe(
    "https://muse.example.test/callback",
  );
  expect(callback.searchParams.get("from")).toBe("ruletrade");
  expect(callback.searchParams.get("state")).toBe(state);
  expect(callback.searchParams.get("iss")).toBe(origin);
  const code = callback.searchParams.get("code")!;
  expect(code).toMatch(/^rtc_[A-Za-z0-9_-]{43}$/);
  return { id, code };
}

function redeem(
  code: string,
  overrides: Record<string, string> = {},
  authorization = basic,
) {
  return exchange(
    post(
      "/oauth/token",
      {
        grant_type: "authorization_code",
        code,
        redirect_uri: redirect,
        code_verifier: verifier,
        ...overrides,
      },
      { Authorization: authorization },
    ),
  );
}

function rotate(refreshToken: string, overrides: Record<string, string> = {}) {
  return exchange(
    post("/oauth/token", {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      ...credentials,
      ...overrides,
    }),
  );
}

function api(token?: string, write = false) {
  const headers = token ? { Authorization: "Bearer " + token } : undefined;
  return write
    ? capture(
        new Request(resource + "/captures", {
          method: "POST",
          headers,
          body: JSON.stringify({
            clientRequestId: crypto.randomUUID(),
            rawInput: "OAuth テスト",
          }),
        }),
      )
    : status(new Request(resource + "/status", { headers }));
}

async function expectInvalidGrant(response: Response) {
  expect(response.status).toBe(400);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ error: "invalid_grant" });
}

async function createTokens(selected?: string[]) {
  const { code } = await issueCode(selected);
  const response = await redeem(code);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  return (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
  };
}

beforeEach(() => {
  vi.stubEnv("RULETRADE_DATABASE_PATH", path.join(directory, "test.sqlite"));
  vi.stubEnv("RULETRADE_OAUTH_CLIENT_ID", clientId);
  vi.stubEnv(
    "RULETRADE_OAUTH_CLIENT_SECRET_HASH",
    hash(dummySecret).digest("hex"),
  );
  vi.stubEnv(
    "RULETRADE_OAUTH_REDIRECT_URIS",
    redirect + ",https://muse.example.test/alternate",
  );
  vi.stubEnv("RULETRADE_OAUTH_OWNER_LOGIN", owner);
  vi.stubEnv("RULETRADE_OAUTH_SCOPES", scopes);
  vi.stubEnv("RULETRADE_READ_TOKEN", undefined);
  vi.stubEnv("RULETRADE_WRITE_TOKEN", undefined);
  getDb().delete(oauthAuthRequests).run();
  getDb().delete(integrationGrants).run();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
afterAll(() => {
  getDb().$client.close();
  rmSync(directory, { recursive: true, force: true });
});

it("advertises issuer, endpoints, S256 and client authentication behind Serve", async () => {
  const response = discover(
    new Request(
      "http://127.0.0.1:3001/.well-known/oauth-authorization-server",
      {
        headers: {
          "X-Forwarded-Host": "ruletrade.example.test:9445",
          "X-Forwarded-Proto": "https",
        },
      },
    ),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    issuer: origin,
    authorization_endpoint: origin + "/oauth/authorize",
    token_endpoint: origin + "/oauth/token",
    revocation_endpoint: origin + "/oauth/revoke",
    scopes_supported: scopes.split(" "),
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: [
      "client_secret_basic",
      "client_secret_post",
    ],
    revocation_endpoint_auth_methods_supported: [
      "client_secret_basic",
      "client_secret_post",
    ],
    authorization_response_iss_parameter_supported: true,
  });
});

it("disables every OAuth endpoint when registration is incomplete", async () => {
  vi.stubEnv("RULETRADE_OAUTH_CLIENT_ID", undefined);
  expect(discover(new Request(origin)).status).toBe(404);
  expect(authorize(authorizeRequest()).status).toBe(404);
  expect((await consent("dummy")).status).toBe(404);
  expect((await redeem("dummy")).status).toBe(404);
  expect(
    (await revoke(post("/oauth/revoke", { token: "dummy", ...credentials })))
      .status,
  ).toBe(404);
});

it("requires the owner on GET and POST and rejects a cross-origin approval", async () => {
  for (const login of [null, "another@example.test"]) {
    const response = authorize(authorizeRequest({}, login));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "access_denied" });
  }
  const { id } = await pendingRequest();
  const anonymous = post("/oauth/authorize", {
    request_id: id,
    decision: "approve",
    scope: "ledger:read",
  });
  expect((await approve(anonymous)).status).toBe(403);
  expect(
    (
      await consent(id, undefined, {
        "Tailscale-User-Login": "another@example.test",
      })
    ).status,
  ).toBe(403);
  expect(
    (await consent(id, undefined, { Origin: "https://other.example.test" }))
      .status,
  ).toBe(403);
  expect((await consent(id)).status).toBe(303);
});

it("uses exact redirect registration and validates S256 and the resource", async () => {
  const unregistered = authorize(
    authorizeRequest({ redirect_uri: redirect + "/" }),
  );
  expect(unregistered.status).toBe(400);
  expect(unregistered.headers.get("location")).toBeNull();
  for (const [overrides, error] of [
    [{ code_challenge_method: "plain" }, "invalid_request"],
    [{ code_challenge: null }, "invalid_request"],
    [{ resource: origin + "/different" }, "invalid_target"],
    [{ scope: "ledger:admin" }, "invalid_scope"],
  ] as const) {
    const result = authorize(authorizeRequest(overrides));
    const callback = new URL(result.headers.get("location")!);
    expect(callback.searchParams.get("error")).toBe(error);
    expect(callback.searchParams.get("state")).toBe(state);
    expect(callback.searchParams.get("iss")).toBe(origin);
  }
  expect(
    authorize(authorizeRequest({ resource: null, scope: null })).status,
  ).toBe(200);
});

it("binds approval to the request, defaults to read, and approves only once", async () => {
  const { id, html } = await pendingRequest();
  expect(html).toContain("Muse");
  expect(html).toContain("muse.example.test");
  expect(html).toContain("90 日");
  expect(html).toContain('value="ledger:read" checked');
  expect(html).toContain('value="ledger:write">');
  expect((await consent(id, ["ledger:admin"])).status).toBe(400);
  expect((await consent(id)).status).toBe(303);
  expect((await consent(id)).status).toBe(400);
});

it("returns access_denied and closes the request when the owner declines", async () => {
  const { id } = await pendingRequest();
  const response = await approve(
    post(
      "/oauth/authorize",
      { request_id: id, decision: "deny" },
      {
        "Tailscale-User-Login": owner,
        Origin: origin,
      },
    ),
  );
  const callback = new URL(response.headers.get("location")!);
  expect(callback.searchParams.get("error")).toBe("access_denied");
  expect(callback.searchParams.get("state")).toBe(state);
  expect(callback.searchParams.get("iss")).toBe(origin);
  expect((await consent(id)).status).toBe(400);
  expect(getDb().select().from(integrationGrants).all()).toHaveLength(0);
});

it("authenticates access tokens, rotates refresh tokens, and revokes the grant", async () => {
  const tokens = await createTokens();
  expect(tokens.access_token).toMatch(/^rta_[A-Za-z0-9_-]{43}$/);
  expect(tokens.refresh_token).toMatch(/^rtr_[A-Za-z0-9_-]{43}$/);
  expect(tokens).toMatchObject({
    token_type: "Bearer",
    expires_in: 3600,
    scope: "ledger:read",
  });
  expect((await api(tokens.access_token)).status).toBe(200);
  expect((await api(tokens.access_token, true)).status).toBe(401);
  expect((await api(tokens.refresh_token)).status).toBe(401);
  expect(
    (await rotate(tokens.refresh_token, { resource: origin + "/different" }))
      .status,
  ).toBe(400);

  const rotated = await rotate(tokens.refresh_token);
  expect(rotated.status).toBe(200);
  const next = await rotated.json();
  expect(next.access_token).not.toBe(tokens.access_token);
  expect(next.refresh_token).not.toBe(tokens.refresh_token);
  expect((await api(next.access_token)).status).toBe(200);

  for (const token of [next.refresh_token, next.refresh_token, "unknown"]) {
    const response = await revoke(
      post(
        "/oauth/revoke",
        { token, token_type_hint: "access_token" },
        { Authorization: basic },
      ),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  }
  for (const access of [tokens.access_token, next.access_token]) {
    const response = await api(access);
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(
      'Bearer error="invalid_token"',
    );
  }
  expect((await api()).headers.get("www-authenticate")).toBe("Bearer");
  await expectInvalidGrant(await rotate(next.refresh_token));
  expect(
    getDb()
      .select()
      .from(integrationTokens)
      .all()
      .every((row) => row.revokedAt),
  ).toBe(true);
});

it("keeps write independent from read and accepts API keys in the same DB", async () => {
  const tokens = await createTokens(["ledger:write"]);
  expect(tokens.scope).toBe("ledger:write");
  expect((await api(tokens.access_token, true)).status).toBe(201);
  expect((await api(tokens.access_token)).status).toBe(401);
  const key = issueApiKey(getDb(), "read");
  expect((await api(key)).status).toBe(200);
  const grant = getDb()
    .select()
    .from(integrationGrants)
    .where(eq(integrationGrants.kind, "api_key"))
    .get()!;
  const blocked = await uiRevoke(
    post(
      "/more/connections/revoke",
      { grant_id: grant.id },
      { Origin: "https://other.example.test" },
    ),
  );
  expect(blocked.status).toBe(403);
  expect((await api(key)).status).toBe(200);
  const result = await uiRevoke(
    post(
      "/more/connections/revoke",
      { grant_id: grant.id },
      { Origin: origin },
    ),
  );
  expect(result.status).toBe(303);
  expect((await api(key)).status).toBe(401);
  expect((await api(tokens.access_token, true)).status).toBe(201);
});

it("rejects invalid client credentials for both authentication methods", async () => {
  const { code } = await issueCode();
  const unauthorized = await redeem(
    code,
    {},
    "Basic " + Buffer.from("muse%2Btest:wrong").toString("base64"),
  );
  expect(unauthorized.status).toBe(401);
  expect(unauthorized.headers.get("www-authenticate")).toMatch(/^Basic /);
  expect(await unauthorized.json()).toEqual({ error: "invalid_client" });
  const bodyAuth = await exchange(
    post("/oauth/token", {
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      redirect_uri: redirect,
      ...credentials,
      client_secret: "wrong",
    }),
  );
  expect(bodyAuth.status).toBe(400);
  expect(await bodyAuth.json()).toEqual({ error: "invalid_client" });
  expect((await redeem(code, credentials)).status).toBe(400);
  expect((await redeem(code)).status).toBe(200);
});

it("rejects a wrong verifier or redirect; valid code reuse revokes all issued tokens", async () => {
  const { code } = await issueCode();
  await expectInvalidGrant(
    await redeem(code, { code_verifier: "z".repeat(43) }),
  );
  await expectInvalidGrant(
    await redeem(code, { redirect_uri: "https://muse.example.test/alternate" }),
  );
  const { access_token: access, refresh_token: refresh } = await (
    await redeem(code)
  ).json();
  expect((await api(access)).status).toBe(200);
  await expectInvalidGrant(await redeem(code));
  expect((await api(access)).status).toBe(401);
  await expectInvalidGrant(await rotate(refresh));
});

it("revokes the whole grant when a rotated refresh token is reused", async () => {
  const tokens = await createTokens(scopes.split(" "));
  const response = await rotate(tokens.refresh_token);
  expect(response.status).toBe(200);
  const { access_token: access, refresh_token: refresh } =
    await response.json();
  await expectInvalidGrant(await rotate(tokens.refresh_token));
  expect((await api(tokens.access_token)).status).toBe(401);
  expect((await api(access)).status).toBe(401);
  await expectInvalidGrant(await rotate(refresh));
});

it("enforces consent, code, access, refresh and grant deadlines", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  const now = Date.now();
  const pending = await pendingRequest();
  vi.setSystemTime(now + 600_000);
  expect((await consent(pending.id)).status).toBe(400);
  const expired = await issueCode();
  vi.setSystemTime(now + 720_000);
  await expectInvalidGrant(await redeem(expired.code));

  const tokens = await createTokens();
  const issuedAt = Date.now();
  vi.setSystemTime(issuedAt + 3_600_000);
  expect((await api(tokens.access_token)).status).toBe(401);
  vi.setSystemTime(issuedAt + 30 * day);
  await expectInvalidGrant(await rotate(tokens.refresh_token));

  const another = await createTokens();
  const grantedAt = Date.now();
  let refreshToken = another.refresh_token;
  for (const offset of [29, 58, 87]) {
    vi.setSystemTime(grantedAt + offset * day);
    const response = await rotate(refreshToken);
    expect(response.status).toBe(200);
    refreshToken = (await response.json()).refresh_token;
  }
  vi.setSystemTime(grantedAt + 90 * day);
  await expectInvalidGrant(await rotate(refreshToken));
});

it("stores only hashes, and neither exports nor imports OAuth state", async () => {
  const { id, code } = await issueCode();
  const row = getDb()
    .select()
    .from(oauthAuthRequests)
    .where(eq(oauthAuthRequests.id, id))
    .get()!;
  expect(row.codeHash).toBe(hash(code).digest("hex"));
  const result = await (await redeem(code)).json();
  const tokens = getDb().select().from(integrationTokens).all();
  expect(tokens.map((token) => token.tokenHash)).toEqual([
    hash(result.access_token).digest("hex"),
    hash(result.refresh_token).digest("hex"),
  ]);
  const exported = await exportJson();
  const document = await exported.text();
  for (const value of [
    id,
    code,
    row.codeHash!,
    result.access_token,
    result.refresh_token,
    "oauth_auth_requests",
    "oauthAuthRequests",
  ]) {
    expect(document).not.toContain(value);
  }
  importJson({
    ...JSON.parse(document),
    oauth_auth_requests: [{ ...row, id: "injected" }],
    oauthAuthRequests: [],
  });
  const stored = getDb().select().from(oauthAuthRequests).all();
  expect(stored).toHaveLength(1);
  expect(stored[0].id).toBe(id);
  expect(stored[0].consumedAt).toEqual(expect.any(String));
});
