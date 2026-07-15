import "server-only";

import { createSqliteClient } from "@/lib/db/sqlite-client";

export type DatabaseClient = ReturnType<typeof createSqliteClient>;

export async function createDatabaseClient(): Promise<DatabaseClient> {
  return createSqliteClient();
}
