import { spawnSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";

import { GET as exportJson } from "@/app/api/export/route";
import { POST as postCapture } from "@/app/api/integration/v1/captures/route";
import { GET as getStatus } from "@/app/api/integration/v1/status/route";
import { issueApiKey } from "@/features/integration/api-keys";
import { importJson } from "@/features/json-import/service";
import { getDb } from "@/lib/db";
import { integrationGrants, integrationTokens } from "@/lib/db/schema";

const directory = mkdtempSync(path.join(os.tmpdir(), "ruletrade-api-keys-"));
const databasePath = path.join(directory, "test.sqlite");
const baseUrl = "http://localhost/api/integration/v1";
const projectRoot = path.resolve(import.meta.dirname, "../../..");

function cli(args: string[], { cwd = projectRoot, env = process.env } = {}) {
  return spawnSync(
    process.execPath,
    [
      "--import",
      import.meta.resolve("tsx"),
      path.join(projectRoot, "scripts/integration-keys.ts"),
      ...args,
    ],
    {
      cwd,
      env: {
        ...env,
        TSX_TSCONFIG_PATH: path.join(projectRoot, "tsconfig.json"),
      },
      encoding: "utf8",
      timeout: 5000,
    },
  );
}

function statusWith(token?: string) {
  return getStatus(
    new Request(baseUrl + "/status", {
      headers: token ? { Authorization: "Bearer " + token } : {},
    }),
  );
}

function captureWith(token?: string) {
  return postCapture(
    new Request(baseUrl + "/captures", {
      method: "POST",
      headers: token ? { Authorization: "Bearer " + token } : {},
      body: JSON.stringify({
        clientRequestId: randomUUID(),
        rawInput: "テスト記録",
      }),
    }),
  );
}

async function expectUnauthorized(response: Response, tokenSupplied = true) {
  expect(response.status).toBe(401);
  expect(response.headers.get("www-authenticate")).toBe(
    tokenSupplied ? 'Bearer error="invalid_token"' : "Bearer",
  );
  expect(await response.json()).toEqual({
    error: { code: "unauthorized", message: "認証に失敗しました。" },
  });
}

beforeEach(() => {
  vi.stubEnv("RULETRADE_DATABASE_PATH", databasePath);
  vi.stubEnv("RULETRADE_OAUTH_SCOPES", "ledger:read, ledger:write");
  vi.stubEnv("RULETRADE_READ_TOKEN", undefined);
  vi.stubEnv("RULETRADE_WRITE_TOKEN", undefined);
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

it("issues a read key from the CLI and accepts it immediately on GET /status", async () => {
  await expectUnauthorized(await statusWith(), false);
  const issued = cli(["issue", "--scope", "read"]);
  expect(issued.status).toBe(0);
  expect(issued.stderr).toBe("");
  expect(/^rtk_[A-Za-z0-9_-]{43}\n$/.test(issued.stdout)).toBe(true);
  const token = issued.stdout.trim();
  expect(Buffer.from(token.slice(4), "base64url").length).toBe(32);

  const response = await statusWith(token);
  expect(response.status).toBe(200);
  expect((await response.text()).includes(token)).toBe(false);

  const listed = cli(["list"]);
  expect(listed.status).toBe(0);
  expect(listed.stdout.includes(token)).toBe(false);
  const [grant] = JSON.parse(listed.stdout);
  expect(grant.scopes).toEqual(["ledger:read"]);
  expect(grant.lastUsedAt).toEqual(expect.any(String));
  expect(Date.parse(grant.expiresAt) - Date.parse(grant.createdAt)).toBe(
    90 * 24 * 60 * 60 * 1000,
  );
});

it("uses the explicit DB path for issue, list, and revoke when .env.local cannot be read", () => {
  const cwd = mkdtempSync(path.join(directory, "cli-env-"));
  mkdirSync(path.join(cwd, ".env.local"));

  expect(cli(["issue", "--scope", "read"], { cwd }).status).toBe(0);
  const grant = getDb().select().from(integrationGrants).get();
  expect(grant?.scopes).toEqual(["ledger:read"]);

  const listed = cli(["list"], { cwd });
  expect(listed.status).toBe(0);
  expect(JSON.parse(listed.stdout)).toEqual([grant]);

  expect(cli(["revoke", grant!.id], { cwd }).status).toBe(0);
  expect(getDb().select().from(integrationGrants).get()?.revokedAt).toEqual(
    expect.any(String),
  );
});

it("reads the DB path from .env.local when RULETRADE_DATABASE_PATH is unset", () => {
  const cwd = mkdtempSync(path.join(directory, "cli-env-"));
  writeFileSync(
    path.join(cwd, ".env.local"),
    `RULETRADE_DATABASE_PATH="${databasePath}"\n`,
  );
  const env = { ...process.env };
  delete env.RULETRADE_DATABASE_PATH;

  expect(cli(["issue", "--scope", "write"], { cwd, env }).status).toBe(0);
  expect(getDb().select().from(integrationGrants).get()?.scopes).toEqual([
    "ledger:write",
  ]);
});

it("returns 401 when a read key is used for POST", async () => {
  await expectUnauthorized(await captureWith(issueApiKey(getDb(), "read")));
});

it("returns 401 when a write key is used for GET but accepts it on POST", async () => {
  const token = issueApiKey(getDb(), "write");
  await expectUnauthorized(await statusWith(token));
  expect((await captureWith(token)).status).toBe(201);
});

it.each([
  ["token", integrationTokens],
  ["grant", integrationGrants],
] as const)("returns 401 when the %s has expired", async (_kind, table) => {
  const token = issueApiKey(getDb(), "read");
  getDb()
    .update(table)
    .set({ expiresAt: new Date(0).toISOString() })
    .run();
  await expectUnauthorized(await statusWith(token));
});

it.each([
  ["token", integrationTokens],
  ["grant", integrationGrants],
] as const)(
  "returns 401 when only the %s has been revoked",
  async (_kind, table) => {
    const token = issueApiKey(getDb(), "read");
    getDb().update(table).set({ revokedAt: new Date().toISOString() }).run();
    await expectUnauthorized(await statusWith(token));
  },
);

it("rejects a key revoked from the CLI immediately on the same app connection", async () => {
  const token = issueApiKey(getDb(), "read");
  const [grant] = getDb().select().from(integrationGrants).all();
  expect((await statusWith(token)).status).toBe(200);

  const revoked = cli(["revoke", grant.id]);
  expect(revoked.status).toBe(0);
  expect(revoked.stdout).toBe("");
  await expectUnauthorized(await statusWith(token));
  const keyRow = getDb().select().from(integrationTokens).get();
  expect(keyRow?.revokedAt).toEqual(expect.any(String));
});

it("returns 404 for disabled scopes with and without Authorization even if keys exist", async () => {
  vi.stubEnv("RULETRADE_OAUTH_SCOPES", "ledger:other");
  vi.stubEnv("RULETRADE_READ_TOKEN", "   ");
  const readKey = issueApiKey(getDb(), "read");
  const writeKey = issueApiKey(getDb(), "write");
  for (const result of [
    await statusWith(),
    await statusWith(readKey),
    await captureWith(),
    await captureWith(writeKey),
  ]) {
    expect(result.status).toBe(404);
    expect(result.headers.get("www-authenticate")).toBe(null);
    expect((await result.json()).error.code).toBe("not_found");
  }
});

it("enables a scope from the legacy setting and tries both credential types", async () => {
  vi.stubEnv("RULETRADE_OAUTH_SCOPES", "ledger:write");
  const legacy = randomBytes(32).toString("base64url");
  vi.stubEnv("RULETRADE_READ_TOKEN", legacy);
  expect((await statusWith(legacy)).status).toBe(200);
  expect((await statusWith(issueApiKey(getDb(), "read"))).status).toBe(200);
});

it("rejects mismatching hashes, unexpected token and grant types, and malformed Bearer", async () => {
  const token = issueApiKey(getDb(), "read");
  const unknownToken = "rtk_" + randomBytes(32).toString("base64url");
  await expectUnauthorized(await statusWith(unknownToken));
  const malformed = new Request(baseUrl + "/status", {
    headers: { Authorization: "Bearer" },
  });
  await expectUnauthorized(await getStatus(malformed), false);

  getDb().update(integrationTokens).set({ type: "access" }).run();
  await expectUnauthorized(await statusWith(token));
  getDb().update(integrationTokens).set({ type: "api_key" }).run();
  getDb().update(integrationGrants).set({ kind: "oauth" }).run();
  await expectUnauthorized(await statusWith(token));
});

it("updates the grant's last use no more than once per minute", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  const now = Date.now();
  const token = issueApiKey(getDb(), "read");
  const lastUsedAt = () =>
    getDb().select().from(integrationGrants).get()?.lastUsedAt;

  expect(lastUsedAt()).toBe(null);
  expect((await statusWith(token)).status).toBe(200);
  expect(lastUsedAt()).toBe(new Date(now).toISOString());

  vi.setSystemTime(now + 59_999);
  expect((await statusWith(token)).status).toBe(200);
  expect(lastUsedAt()).toBe(new Date(now).toISOString());

  vi.setSystemTime(now + 60_000);
  expect((await statusWith(token)).status).toBe(200);
  expect(lastUsedAt()).toBe(new Date(now + 60_000).toISOString());
});

it("stores the SHA-256 hash without the plaintext in SQLite", () => {
  const token = issueApiKey(getDb(), "read");
  const row = getDb().select().from(integrationTokens).get();
  const hash = createHash("sha256").update(token).digest("hex");
  expect(row?.tokenHash === hash).toBe(true);
  expect(readFileSync(databasePath).includes(token)).toBe(false);
  expect(cli(["list"]).stdout.includes(hash)).toBe(false);
});

it("excludes the vault from JSON export and ignores injected vault rows on import", async () => {
  const token = issueApiKey(getDb(), "read");
  const [grant] = getDb().select().from(integrationGrants).all();
  const response = await exportJson();
  expect(response.status).toBe(200);
  const json = await response.json();
  for (const name of [
    "integrationGrants",
    "integrationTokens",
    "integration_grants",
    "integration_tokens",
  ]) {
    expect(json).not.toHaveProperty(name);
  }
  expect(JSON.stringify(json).includes(grant.id)).toBe(false);

  expect(cli(["revoke", grant.id]).status).toBe(0);
  const otherId = randomUUID();
  const tokens = [
    { ...getDb().select().from(integrationTokens).get(), grantId: otherId },
  ];
  const grants = [{ ...grant, id: otherId, revokedAt: null }];
  importJson({
    ...json,
    integrationGrants: [grant, ...grants],
    integrationTokens: tokens,
    integration_grants: [grant, ...grants],
    integration_tokens: tokens,
  });
  expect(getDb().select().from(integrationGrants).all()).toHaveLength(1);
  expect(getDb().select().from(integrationTokens).all()).toHaveLength(1);
  expect(
    getDb()
      .select()
      .from(integrationGrants)
      .where(eq(integrationGrants.id, grant.id))
      .get()?.revokedAt,
  ).toEqual(expect.any(String));
  await expectUnauthorized(await statusWith(token));
});

it("accepts explicit days and rejects invalid arguments without echoing values", () => {
  const custom = cli(["issue", "--scope", "write", "--days", "7"]);
  expect(custom.status).toBe(0);
  const grant = getDb().select().from(integrationGrants).get()!;
  expect(grant.scopes).toEqual(["ledger:write"]);
  expect(Date.parse(grant.expiresAt) - Date.parse(grant.createdAt)).toBe(
    7 * 24 * 60 * 60 * 1000,
  );

  const secret = randomBytes(32).toString("base64url");
  for (const rejected of [
    cli(["issue", "--scope", "read", "--days", "0"]),
    cli(["issue", "--scope", "read", "--days", secret]),
    cli(["revoke", secret]),
  ]) {
    expect(rejected.status).toBe(1);
    expect(rejected.stdout).toBe("");
    expect(rejected.stderr.includes(secret)).toBe(false);
  }
  expect(getDb().select().from(integrationGrants).all()).toHaveLength(1);
});
