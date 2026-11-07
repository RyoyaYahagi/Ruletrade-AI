import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";

import type { AppDatabase } from "@/lib/db";
import { integrationRequests } from "@/lib/db/schema";

export const CLIENT_REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AppDatabaseTransaction = Parameters<
  Parameters<AppDatabase["transaction"]>[0]
>[0];

type IntegrationRequestRow = typeof integrationRequests.$inferSelect;

export type IdempotentWriteResult<T> =
  | { kind: "created"; resource: T }
  | { kind: "replayed"; resource: T }
  | { kind: "conflict" };

export class IdempotencyResourceMissingError extends Error {
  constructor() {
    super("冪等キーが参照するリソースが見つかりません。");
    this.name = "IdempotencyResourceMissingError";
  }
}

export function isClientRequestId(value: string): boolean {
  return CLIENT_REQUEST_ID_PATTERN.test(value);
}

function canonicalize(value: unknown): unknown {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, canonicalize(record[key])]),
    );
  }
  return value;
}

/**
 * 仕様 §5.1 の「clientRequestId を除いた本文」のハッシュ。
 * 呼び出し側が省略時の既定値（配列は []、それ以外は null）を入れてから渡す。
 */
export function hashRequestBody(body: Record<string, unknown>): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(body)), "utf8")
    .digest("hex");
}

function hasSqliteCode(error: unknown, expected: string): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current != null; depth += 1) {
    if (
      typeof current === "object" &&
      current !== null &&
      "code" in current &&
      (current as { code?: unknown }).code === expected
    ) {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

function replayOrConflict<T>(
  row: IntegrationRequestRow,
  options: {
    db: AppDatabase;
    endpoint: string;
    requestHash: string;
    load: (db: AppDatabase, resourceId: string) => T | null;
  },
): IdempotentWriteResult<T> {
  if (
    row.endpoint !== options.endpoint ||
    row.requestHash !== options.requestHash
  ) {
    return { kind: "conflict" };
  }
  const resource = options.load(options.db, row.resourceId);
  if (resource === null) throw new IdempotencyResourceMissingError();
  return { kind: "replayed", resource };
}

/**
 * 書き込みと integration_requests への記録を同じトランザクションで行う。
 * R-08 も同じ契約で使う:
 * - write は tx 内でリソースを作成し、その ID を返す。
 * - 存在しない参照先などは write から throw し、部分書き込みをロールバックする。
 * - load は再送時に現在のリソースを返す。見つからなければ null。
 */
export function executeIdempotentWrite<T>(options: {
  db: AppDatabase;
  clientRequestId: string;
  endpoint: string;
  requestBody: Record<string, unknown>;
  resourceType: string;
  write: (tx: AppDatabaseTransaction, now: string) => string;
  load: (db: AppDatabase, resourceId: string) => T | null;
}): IdempotentWriteResult<T> {
  const requestHash = hashRequestBody(options.requestBody);
  // UUID は大文字小文字を区別しないため、キーは小文字に揃える。
  const clientRequestId = options.clientRequestId.toLowerCase();

  const findByClientRequestId = (db: AppDatabase) =>
    db
      .select()
      .from(integrationRequests)
      .where(eq(integrationRequests.clientRequestId, clientRequestId))
      .get();

  const existing = findByClientRequestId(options.db);
  if (existing) {
    return replayOrConflict(existing, {
      db: options.db,
      endpoint: options.endpoint,
      requestHash,
      load: options.load,
    });
  }

  let createdResourceId: string;
  try {
    createdResourceId = options.db.transaction(
      (tx) => {
        const raced = tx
          .select()
          .from(integrationRequests)
          .where(
            eq(integrationRequests.clientRequestId, clientRequestId),
          )
          .get();
        if (raced) {
          throw new ExistingRequestError(raced);
        }

        const now = new Date().toISOString();
        const resourceId = options.write(tx, now);
        tx.insert(integrationRequests)
          .values({
            clientRequestId,
            endpoint: options.endpoint,
            requestHash,
            resourceType: options.resourceType,
            resourceId,
            createdAt: now,
          })
          .run();
        return resourceId;
      },
      { behavior: "immediate" },
    );
  } catch (error) {
    if (error instanceof ExistingRequestError) {
      return replayOrConflict(error.row, {
        db: options.db,
        endpoint: options.endpoint,
        requestHash,
        load: options.load,
      });
    }
    if (
      hasSqliteCode(error, "SQLITE_CONSTRAINT_PRIMARYKEY") ||
      hasSqliteCode(error, "SQLITE_CONSTRAINT_UNIQUE")
    ) {
      const raced = findByClientRequestId(options.db);
      if (raced) {
        return replayOrConflict(raced, {
          db: options.db,
          endpoint: options.endpoint,
          requestHash,
          load: options.load,
        });
      }
    }
    throw error;
  }

  const resource = options.load(options.db, createdResourceId);
  if (resource === null) throw new IdempotencyResourceMissingError();
  return { kind: "created", resource };
}

class ExistingRequestError extends Error {
  constructor(readonly row: IntegrationRequestRow) {
    super("同じ clientRequestId がすでに記録されています。");
    this.name = "ExistingRequestError";
  }
}
