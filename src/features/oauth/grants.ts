import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import { and, eq } from "drizzle-orm";

import {
  hashIntegrationToken,
  revokeIntegrationGrant,
} from "@/features/integration/api-keys";
import type { AppDatabase } from "@/lib/db/connection";
import {
  integrationGrants,
  integrationTokens,
  oauthAuthRequests,
} from "@/lib/db/schema";

const dayMs = 24 * 60 * 60 * 1000;
const accessLifetimeMs = 60 * 60 * 1000;
export const grantLifetimeDays = 90;

type Transaction = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

export function createAuthorizationRequest(
  db: AppDatabase,
  request: Pick<
    typeof oauthAuthRequests.$inferInsert,
    | "clientId"
    | "redirectUri"
    | "scopes"
    | "codeChallenge"
    | "state"
    | "resource"
  >,
) {
  const id = randomUUID();
  db.insert(oauthAuthRequests)
    .values({
      ...request,
      id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })
    .run();
  return id;
}

export function decideAuthorizationRequest(
  db: AppDatabase,
  {
    id,
    clientId,
    redirectUris,
    resource,
    enabledScopes,
    selectedScopes,
    approved,
  }: {
    id: string;
    clientId: string;
    redirectUris: string[];
    resource: string;
    enabledScopes: readonly string[];
    selectedScopes: string[];
    approved: boolean;
  },
) {
  return db.transaction(
    (tx) => {
      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const pending = tx
        .select()
        .from(oauthAuthRequests)
        .where(eq(oauthAuthRequests.id, id))
        .get();
      if (
        !pending ||
        pending.clientId !== clientId ||
        !redirectUris.includes(pending.redirectUri) ||
        pending.resource !== resource ||
        pending.expiresAt <= nowIso ||
        pending.codeHash ||
        pending.consumedAt
      ) {
        return { error: "invalid_request" } as const;
      }
      const { redirectUri, state } = pending;
      if (!approved) {
        tx.update(oauthAuthRequests)
          .set({ consumedAt: nowIso })
          .where(eq(oauthAuthRequests.id, id))
          .run();
        return {
          redirectUri,
          state,
          result: { error: "access_denied" },
        } as const;
      }
      const scopes = [...new Set(selectedScopes)];
      if (
        !scopes.length ||
        scopes.some(
          (scope) =>
            !pending.scopes.includes(scope) || !enabledScopes.includes(scope),
        )
      ) {
        return { error: "invalid_scope" } as const;
      }
      const grantId = randomUUID();
      const code = randomToken("rtc_");
      tx.insert(integrationGrants)
        .values({
          id: grantId,
          kind: "oauth",
          clientId,
          label: "Muse",
          scopes,
          createdAt: nowIso,
          expiresAt: new Date(now + grantLifetimeDays * dayMs).toISOString(),
        })
        .run();
      tx.update(oauthAuthRequests)
        .set({
          grantId,
          codeHash: tokenHash(code),
          expiresAt: new Date(now + 120 * 1000).toISOString(),
        })
        .where(eq(oauthAuthRequests.id, id))
        .run();
      return { redirectUri, state, result: { code } } as const;
    },
    { behavior: "immediate" },
  );
}

function randomToken(prefix: "rtc_" | "rta_" | "rtr_") {
  return prefix + randomBytes(32).toString("base64url");
}

function tokenHash(token: string) {
  return hashIntegrationToken(token).toString("hex");
}

function insertTokenPair(
  tx: Transaction,
  grant: typeof integrationGrants.$inferSelect,
  now: number,
) {
  const access = randomToken("rta_");
  const refresh = randomToken("rtr_");
  const grantExpiry = Date.parse(grant.expiresAt);
  const accessExpiry = Math.min(now + accessLifetimeMs, grantExpiry);
  tx.insert(integrationTokens)
    .values([
      {
        id: randomUUID(),
        grantId: grant.id,
        type: "access",
        tokenHash: tokenHash(access),
        expiresAt: new Date(accessExpiry).toISOString(),
      },
      {
        id: randomUUID(),
        grantId: grant.id,
        type: "refresh",
        tokenHash: tokenHash(refresh),
        expiresAt: new Date(
          Math.min(now + 30 * dayMs, grantExpiry),
        ).toISOString(),
      },
    ])
    .run();
  return {
    access_token: access,
    token_type: "Bearer",
    expires_in: Math.floor((accessExpiry - now) / 1000),
    refresh_token: refresh,
    scope: grant.scopes.join(" "),
  };
}

export function exchangeAuthorizationCode(
  db: AppDatabase,
  {
    clientId,
    code,
    redirectUri,
    verifier,
    resource,
  }: {
    clientId: string;
    code: string;
    redirectUri: string;
    verifier: string;
    resource: string;
  },
) {
  if (
    !/^rtc_[A-Za-z0-9_-]{43}$/.test(code) ||
    !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)
  ) {
    return { error: "invalid_grant" } as const;
  }
  return db.transaction(
    (tx) => {
      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const row = tx
        .select({ request: oauthAuthRequests, grant: integrationGrants })
        .from(oauthAuthRequests)
        .innerJoin(
          integrationGrants,
          eq(integrationGrants.id, oauthAuthRequests.grantId),
        )
        .where(
          and(
            eq(oauthAuthRequests.codeHash, tokenHash(code)),
            eq(oauthAuthRequests.clientId, clientId),
            eq(oauthAuthRequests.redirectUri, redirectUri),
            eq(oauthAuthRequests.resource, resource),
            eq(integrationGrants.clientId, clientId),
            eq(integrationGrants.kind, "oauth"),
          ),
        )
        .get();
      if (!row) return { error: "invalid_grant" } as const;
      const expected = Buffer.from(row.request.codeChallenge, "base64url");
      if (
        expected.length !== 32 ||
        !timingSafeEqual(expected, hashIntegrationToken(verifier))
      ) {
        return { error: "invalid_grant" } as const;
      }
      if (row.request.consumedAt) {
        revokeIntegrationGrant(tx, row.grant.id, "oauth");
        return { error: "invalid_grant" } as const;
      }
      if (
        row.request.expiresAt <= nowIso ||
        row.grant.expiresAt <= nowIso ||
        row.grant.revokedAt
      ) {
        return { error: "invalid_grant" } as const;
      }
      tx.update(oauthAuthRequests)
        .set({ consumedAt: nowIso })
        .where(eq(oauthAuthRequests.id, row.request.id))
        .run();
      return { tokens: insertTokenPair(tx, row.grant, now) } as const;
    },
    { behavior: "immediate" },
  );
}

function findOAuthToken(
  tx: Transaction,
  token: string,
  clientId: string,
  type: "refresh" | "access",
) {
  return tx
    .select({ token: integrationTokens, grant: integrationGrants })
    .from(integrationTokens)
    .innerJoin(
      integrationGrants,
      eq(integrationGrants.id, integrationTokens.grantId),
    )
    .where(
      and(
        eq(integrationTokens.tokenHash, tokenHash(token)),
        eq(integrationTokens.type, type),
        eq(integrationGrants.kind, "oauth"),
        eq(integrationGrants.clientId, clientId),
      ),
    )
    .get();
}

export function rotateRefreshToken(
  db: AppDatabase,
  clientId: string,
  refresh: string,
  resource: string,
  scope: string | null,
) {
  if (!/^rtr_[A-Za-z0-9_-]{43}$/.test(refresh))
    return { error: "invalid_grant" } as const;
  return db.transaction(
    (tx) => {
      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const row = findOAuthToken(tx, refresh, clientId, "refresh");
      if (!row) return { error: "invalid_grant" } as const;
      const { token, grant } = row;
      const authorization = tx
        .select({ id: oauthAuthRequests.id })
        .from(oauthAuthRequests)
        .where(
          and(
            eq(oauthAuthRequests.grantId, grant.id),
            eq(oauthAuthRequests.resource, resource),
          ),
        )
        .get();
      if (!authorization) return { error: "invalid_grant" } as const;
      if (token.usedAt) {
        revokeIntegrationGrant(tx, grant.id, "oauth");
        return { error: "invalid_grant" } as const;
      }
      if (
        token.expiresAt <= nowIso ||
        grant.expiresAt <= nowIso ||
        token.revokedAt ||
        grant.revokedAt
      ) {
        return { error: "invalid_grant" } as const;
      }
      if (scope !== null) {
        const requested = new Set(scope.split(" "));
        if (
          requested.size !== grant.scopes.length ||
          grant.scopes.some((value) => !requested.has(value))
        ) {
          return { error: "invalid_scope" } as const;
        }
      }
      tx.update(integrationTokens)
        .set({ usedAt: nowIso })
        .where(eq(integrationTokens.id, token.id))
        .run();
      return { tokens: insertTokenPair(tx, grant, now) } as const;
    },
    { behavior: "immediate" },
  );
}

export function revokeOAuthToken(
  db: AppDatabase,
  clientId: string,
  token: string,
) {
  const prefix = /^(rtr_|rta_)[A-Za-z0-9_-]{43}$/.exec(token)?.[1];
  if (!prefix) return;
  db.transaction(
    (tx) => {
      const row = findOAuthToken(
        tx,
        token,
        clientId,
        prefix === "rtr_" ? "refresh" : "access",
      );
      if (row) revokeIntegrationGrant(tx, row.grant.id, "oauth");
    },
    { behavior: "immediate" },
  );
}
