import "server-only";

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { schema } from "@/lib/db/schema";

export type AppDatabase = BetterSQLite3Database<typeof schema>;

let database: AppDatabase | undefined;

export function getDb(): AppDatabase {
  if (database) return database;

  const dbPath =
    process.env.RULETRADE_DATABASE_PATH ??
    path.join(process.cwd(), ".data", "ruletrade-mvp.sqlite");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("foreign_keys = ON");
  initializeSchema(sqlite);
  database = drizzle(sqlite, { schema });
  return database;
}

function initializeSchema(connection: Database.Database) {
  connection.exec(`
    CREATE TABLE IF NOT EXISTS stocks (
      id TEXT PRIMARY KEY,
      ticker TEXT,
      name TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      market TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS stocks_ticker_idx ON stocks(ticker);

    CREATE TABLE IF NOT EXISTS decisions (
      id TEXT PRIMARY KEY,
      stock_id TEXT NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      raw_input TEXT NOT NULL,
      transcript TEXT,
      follow_up_answer TEXT,
      thesis TEXT,
      assumptions_json TEXT NOT NULL,
      review_conditions_json TEXT NOT NULL,
      add_conditions_json TEXT NOT NULL,
      review_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS decisions_stock_created_idx ON decisions(stock_id, created_at);
    CREATE INDEX IF NOT EXISTS decisions_review_at_idx ON decisions(review_at);

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      stock_id TEXT NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
      side TEXT NOT NULL,
      quantity REAL NOT NULL,
      price REAL,
      fee REAL,
      executed_at TEXT NOT NULL,
      decision_id TEXT REFERENCES decisions(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS transactions_stock_executed_idx ON transactions(stock_id, executed_at);
    CREATE INDEX IF NOT EXISTS transactions_executed_idx ON transactions(executed_at);

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      stock_id TEXT NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
      decision_id TEXT REFERENCES decisions(id) ON DELETE SET NULL,
      current_input TEXT NOT NULL,
      summary TEXT NOT NULL,
      differences_json TEXT NOT NULL,
      reflection TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS reviews_stock_created_idx ON reviews(stock_id, created_at);
  `);
}
