import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

describe("API token service", () => {
  const originalEnv = { ...process.env };
  const tempDirs: string[] = [];

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
    for (const tempDir of tempDirs.splice(0)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("issues a token once, stores only its hash, and can revoke it", async () => {
    const { service, db } = await loadService();
    const issued = await service.createApiToken({
      userId: "user-a",
      label: "Claude Code",
      scopes: "read,write",
    });

    expect(issued.token).toMatch(/^rta_[a-f0-9]{64}$/);
    const rows = await db.from("api_access_tokens").select("*").eq("user_id", "user-a");
    expect(rows.data).toHaveLength(1);
    expect(rows.data[0]).not.toHaveProperty("token");
    expect(rows.data[0]).toMatchObject({ scopes: "read,write", revoked_at: null });

    await service.revokeApiToken({ userId: "user-a", tokenId: issued.tokenId });
    const listed = await service.listApiTokens({ userId: "user-a" });
    expect(listed.tokens[0]).toMatchObject({ id: issued.tokenId, revoked_at: expect.any(String) });
  });

  it("rejects a sixth active token", async () => {
    const { service } = await loadService();
    for (let index = 0; index < 5; index += 1) {
      await service.createApiToken({ userId: "user-a", label: `token-${index}`, scopes: "read" });
    }

    await expect(
      service.createApiToken({ userId: "user-a", label: "token-6", scopes: "read" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });

  it("requires a write scope and enforces the token minute limit", async () => {
    const { service } = await loadService();
    const readOnly = await service.createApiToken({ userId: "user-a", label: "read", scopes: "read" });
    const { requireTokenUser } = await import("@/lib/auth/require-token-user");
    const request = () => new Request("http://localhost/api/mcp", {
      headers: { Authorization: `Bearer ${readOnly.token}` },
    });

    await expect(requireTokenUser(request(), "write")).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    for (let index = 0; index < 60; index += 1) {
      await requireTokenUser(request(), "read");
    }
    await expect(requireTokenUser(request(), "read")).rejects.toMatchObject({ code: "RATE_LIMITED", status: 429 });
  });

  async function loadService() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ruletrade-api-token-"));
    tempDirs.push(tempDir);
    process.env.SQLITE_DATABASE_PATH = path.join(tempDir, "test.sqlite");
    const service = await import("@/features/auth/services/api-token-service");
    const { createSqliteClient } = await import("@/lib/db/sqlite-client");
    return { service, db: createSqliteClient() };
  }
});
