import { createHash, randomBytes, randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import Database from "better-sqlite3";

import { e2eOAuth } from "../setup/e2e-oauth";

test("approves Muse in the browser, exchanges and rotates tokens, and revokes connections", async ({
  page,
  request,
  baseURL,
}) => {
  const metadata = await request.get("/.well-known/oauth-authorization-server");
  expect(metadata.status()).toBe(200);
  const discovery = await metadata.json();
  expect(discovery.issuer).toBe(baseURL);

  const verifier = randomBytes(32).toString("base64url");
  const state = randomUUID();
  const params = new URLSearchParams({
    client_id: e2eOAuth.clientId,
    redirect_uri: e2eOAuth.redirectUri,
    response_type: "code",
    code_challenge_method: "S256",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    resource: baseURL + "/api/integration/v1",
    scope: "ledger:read ledger:write",
    state,
  });

  expect((await request.get("/oauth/authorize?" + params)).status()).toBe(403);
  await page.route("**/oauth/authorize**", (route) =>
    route.continue({
      headers: {
        ...route.request().headers(),
        "Tailscale-User-Login": e2eOAuth.owner,
      },
    }),
  );
  await page.goto("/oauth/authorize?" + params);
  await expect(
    page.getByRole("heading", { name: "Muse との接続" }),
  ).toBeVisible();
  await expect(
    page.getByText(new URL(e2eOAuth.redirectUri).host, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /ledger:read/ }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: /ledger:write/ }),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "許可する" }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.origin === new URL(e2eOAuth.redirectUri).origin &&
      url.searchParams.get("oauth_callback") === "1",
  );
  const callback = new URL(page.url());
  expect(callback.searchParams.get("state")).toBe(state);
  expect(callback.searchParams.get("iss")).toBe(baseURL);

  const basic = Buffer.from(
    e2eOAuth.clientId + ":" + e2eOAuth.dummySecret,
  ).toString("base64");
  const tokenResponse = await request.post(discovery.token_endpoint, {
    headers: { Authorization: "Basic " + basic },
    form: {
      grant_type: "authorization_code",
      code: callback.searchParams.get("code")!,
      redirect_uri: e2eOAuth.redirectUri,
      code_verifier: verifier,
    },
  });
  expect(tokenResponse.status()).toBe(200);
  expect(tokenResponse.headers()["cache-control"]).toBe("no-store");
  const original = await tokenResponse.json();
  expect(original.scope).toBe("ledger:read");

  const status = (token: string) =>
    request.get("/api/integration/v1/status", {
      headers: { Authorization: "Bearer " + token },
    });
  expect((await status(original.access_token)).status()).toBe(200);
  const refresh = await request.post(discovery.token_endpoint, {
    form: {
      grant_type: "refresh_token",
      refresh_token: original.refresh_token,
      client_id: e2eOAuth.clientId,
      client_secret: e2eOAuth.dummySecret,
    },
  });
  expect(refresh.status()).toBe(200);
  const rotated = await refresh.json();
  expect(rotated.refresh_token).not.toBe(original.refresh_token);
  expect((await status(rotated.access_token)).status()).toBe(200);

  const apiKey = "rtk_" + randomBytes(32).toString("base64url");
  const grantId = randomUUID();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
  const db = new Database(".data/e2e-test.sqlite");
  try {
    db.transaction(() => {
      db.prepare(
        "INSERT INTO integration_grants (id, kind, scopes, created_at, expires_at) VALUES (?, 'api_key', ?, ?, ?)",
      ).run(grantId, JSON.stringify(["ledger:read"]), now, expiresAt);
      db.prepare(
        "INSERT INTO integration_tokens (id, grant_id, type, token_hash, expires_at) VALUES (?, ?, 'api_key', ?, ?)",
      ).run(
        randomUUID(),
        grantId,
        createHash("sha256").update(apiKey).digest("hex"),
        expiresAt,
      );
    })();
  } finally {
    db.close();
  }
  expect((await status(apiKey)).status()).toBe(200);

  await page.goto("/more");
  const connections = page.getByRole("region", { name: "接続" });
  const apiKeyRow = connections
    .getByRole("listitem")
    .filter({ hasText: "API キー" });
  const oauthRow = connections
    .getByRole("listitem")
    .filter({ hasText: "OAuth（Muse）" });
  for (const row of [oauthRow, apiKeyRow]) {
    await expect(row.getByText("ledger:read")).toBeVisible();
    await expect(row.getByText("有効期限")).toBeVisible();
    await expect(row.getByText("最終使用")).toBeVisible();
    await expect(row.locator("time")).toHaveCount(2);
  }
  await apiKeyRow.getByRole("button", { name: "取り消す" }).click();
  await expect(apiKeyRow.getByText("取り消し済み")).toBeVisible();
  expect((await status(apiKey)).status()).toBe(401);
  expect((await status(rotated.access_token)).status()).toBe(200);

  const revoked = await request.post(discovery.revocation_endpoint, {
    headers: { Authorization: "Basic " + basic },
    form: { token: rotated.refresh_token },
  });
  expect(revoked.status()).toBe(200);
  const invalid = await status(rotated.access_token);
  expect(invalid.status()).toBe(401);
  expect(invalid.headers()["www-authenticate"]).toBe(
    'Bearer error="invalid_token"',
  );
  await page.reload();
  await expect(oauthRow.getByText("取り消し済み")).toBeVisible();
});
