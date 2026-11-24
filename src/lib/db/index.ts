import "server-only";

import { openDb, type AppDatabase } from "./connection";

export type { AppDatabase } from "./connection";

let database: AppDatabase | undefined;

export function getDb(): AppDatabase {
  return (database ??= openDb());
}
