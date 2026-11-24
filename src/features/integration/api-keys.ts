import { createHash, randomBytes, randomUUID } from "node:crypto";

import { and, asc, eq, gt, isNull, lte, or, sql } from "drizzle-orm";

import type { AppDatabase } from "@/lib/db/connection";
import { integrationGrants, integrationTokens } from "@/lib/db/schema";

export const ledgerScopes = {
  read: "ledger:read",
  write: "ledger:write",
} as const;
export type IntegrationScope = keyof typeof ledgerScopes;

const bearerTokenPattern = /^(rtk_|rta_)[A-Za-z0-9_-]{43}$/;
const dayMs = 24 * 60 * 60 * 1000;
const lastUseIntervalMs = 60 * 1000;

export function hashIntegrationToken(token: string): Buffer {
  return createHash("sha256").update(token, "utf8").digest();
}

export function issueApiKey(
  db: AppDatabase,
  scope: IntegrationScope,
  days = 90,
) {
  const now = Date.now();
  const expiry = now + days * dayMs;
  if (
    !Number.isSafeInteger(days) ||
    days < 1 ||
    expiry > Date.parse("9999-12-31T23:59:59.999Z")
  ) {
    throw new RangeError("有効期間の日数が範囲外です。");
  }

  const expiresAt = new Date(expiry).toISOString();
  const grantId = randomUUID();
  const token = "rtk_" + randomBytes(32).toString("base64url");

  db.transaction((tx) => {
    tx.insert(integrationGrants)
      .values({
        id: grantId,
        kind: "api_key",
        scopes: [ledgerScopes[scope]],
        createdAt: new Date(now).toISOString(),
        expiresAt,
      })
      .run();
    tx.insert(integrationTokens)
      .values({
        id: randomUUID(),
        grantId,
        type: "api_key",
        tokenHash: hashIntegrationToken(token).toString("hex"),
        expiresAt,
      })
      .run();
  });
  return token;
}

export function listIntegrationGrants(db: AppDatabase, kind?: "api_key") {
  return db
    .select()
    .from(integrationGrants)
    .where(kind ? eq(integrationGrants.kind, kind) : undefined)
    .orderBy(asc(integrationGrants.createdAt), asc(integrationGrants.id))
    .all();
}

export function listApiKeys(db: AppDatabase) {
  return listIntegrationGrants(db, "api_key");
}

export function revokeApiKey(db: AppDatabase, grantId: string): boolean {
  return revokeIntegrationGrant(db, grantId, "api_key");
}

export function revokeIntegrationGrant(
  db: Pick<AppDatabase, "transaction">,
  grantId: string,
  kind?: "api_key" | "oauth",
): boolean {
  const revokedAt = new Date().toISOString();
  return db.transaction((tx) => {
    const grant = tx
      .update(integrationGrants)
      .set({
        revokedAt: sql`coalesce(${integrationGrants.revokedAt}, ${revokedAt})`,
      })
      .where(
        and(
          eq(integrationGrants.id, grantId),
          kind ? eq(integrationGrants.kind, kind) : undefined,
        ),
      )
      .returning({ id: integrationGrants.id })
      .get();
    if (!grant) return false;

    tx.update(integrationTokens)
      .set({ revokedAt })
      .where(
        and(
          eq(integrationTokens.grantId, grantId),
          kind === "api_key"
            ? eq(integrationTokens.type, "api_key")
            : undefined,
          isNull(integrationTokens.revokedAt),
        ),
      )
      .run();
    return true;
  });
}

export function verifyIntegrationBearer(
  db: AppDatabase,
  tokenHash: Buffer,
  scope: IntegrationScope,
  type: "api_key" | "access",
): boolean {
  const now = new Date();
  const nowIso = now.toISOString();
  const grant = db
    .select({
      id: integrationGrants.id,
      scopes: integrationGrants.scopes,
      lastUsedAt: integrationGrants.lastUsedAt,
    })
    .from(integrationTokens)
    .innerJoin(
      integrationGrants,
      eq(integrationTokens.grantId, integrationGrants.id),
    )
    .where(
      and(
        eq(integrationTokens.tokenHash, tokenHash.toString("hex")),
        eq(integrationTokens.type, type),
        gt(integrationTokens.expiresAt, nowIso),
        isNull(integrationTokens.revokedAt),
        eq(integrationGrants.kind, type === "api_key" ? "api_key" : "oauth"),
        gt(integrationGrants.expiresAt, nowIso),
        isNull(integrationGrants.revokedAt),
      ),
    )
    .get();
  if (
    !grant ||
    !Array.isArray(grant.scopes) ||
    !grant.scopes.includes(ledgerScopes[scope])
  ) {
    return false;
  }

  const cutoff = new Date(now.getTime() - lastUseIntervalMs).toISOString();
  if (!grant.lastUsedAt || grant.lastUsedAt <= cutoff) {
    // Recheck the cutoff in SQLite so concurrent requests share the same limit.
    db.update(integrationGrants)
      .set({ lastUsedAt: nowIso })
      .where(
        and(
          eq(integrationGrants.id, grant.id),
          isNull(integrationGrants.revokedAt),
          or(
            isNull(integrationGrants.lastUsedAt),
            lte(integrationGrants.lastUsedAt, cutoff),
          ),
        ),
      )
      .run();
  }
  return true;
}

export function integrationBearerType(token: string) {
  const prefix = bearerTokenPattern.exec(token)?.[1];
  if (prefix === "rtk_") return "api_key";
  if (prefix === "rta_") return "access";
  return undefined;
}
