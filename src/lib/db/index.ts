import "server-only";

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import {
  drizzle,
  type BetterSQLite3Database,
} from "drizzle-orm/better-sqlite3";

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
      market_code TEXT,
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

    CREATE TABLE IF NOT EXISTS import_batches (
      id TEXT PRIMARY KEY,
      broker TEXT NOT NULL,
      format TEXT NOT NULL,
      file_name TEXT NOT NULL,
      raw_csv TEXT NOT NULL,
      raw_encoding TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      imported_at TEXT NOT NULL,
      transaction_count REAL NOT NULL,
      duplicate_count REAL NOT NULL,
      excluded_count REAL NOT NULL,
      unknown_count REAL NOT NULL,
      undone_at TEXT
    );
    CREATE TABLE IF NOT EXISTS transaction_import_sources (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      import_batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
      source_row_number REAL NOT NULL,
      source_fingerprint TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS import_sources_batch_row_idx ON transaction_import_sources(import_batch_id, source_row_number);
    CREATE INDEX IF NOT EXISTS import_sources_fingerprint_idx ON transaction_import_sources(source_fingerprint);
    CREATE TABLE IF NOT EXISTS import_changes (
      id TEXT PRIMARY KEY,
      import_batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      before_json TEXT NOT NULL,
      after_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS import_batch_stocks (
      batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
      stock_id TEXT NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
      created_by_batch REAL NOT NULL,
      PRIMARY KEY(batch_id, stock_id)
    );
  `);

  const decisionColumns = new Set(
    (connection.pragma("table_info(decisions)") as Array<{ name: string }>).map(
      ({ name }) => name,
    ),
  );
  if (!decisionColumns.has("edit_history_json")) {
    connection.exec("ALTER TABLE decisions ADD COLUMN edit_history_json TEXT");
  }
  if (!decisionColumns.has("review_dates_json")) {
    connection.exec("ALTER TABLE decisions ADD COLUMN review_dates_json TEXT");
  }
  if (!decisionColumns.has("decided_at")) {
    connection.exec("ALTER TABLE decisions ADD COLUMN decided_at TEXT");
  }

  const transactionColumns: Record<string, string> = {
    price_currency: "TEXT",
    fee_currency: "TEXT",
    settlement_date: "TEXT",
    settlement_currency: "TEXT",
    settlement_amount: "REAL",
    exchange_rate: "REAL",
    account_type: "TEXT",
    source_broker: "TEXT",
    source_trade_type: "TEXT",
    import_batch_id: "TEXT REFERENCES import_batches(id) ON DELETE CASCADE",
    source_fingerprint: "TEXT",
    source_row_number: "REAL",
  };
  const stockColumns = new Set(
    (connection.pragma("table_info(stocks)") as Array<{ name: string }>).map(
      ({ name }) => name,
    ),
  );
  if (!stockColumns.has("market_code"))
    connection.exec("ALTER TABLE stocks ADD COLUMN market_code TEXT");
  const existingColumns = new Set(
    (
      connection.pragma("table_info(transactions)") as Array<{ name: string }>
    ).map(({ name }) => name),
  );
  for (const [name, declaration] of Object.entries(transactionColumns)) {
    if (!existingColumns.has(name)) {
      connection.exec(
        `ALTER TABLE transactions ADD COLUMN ${name} ${declaration}`,
      );
    }
  }
  const batchColumns = new Set(
    (
      connection.pragma("table_info(import_batches)") as Array<{ name: string }>
    ).map(({ name }) => name),
  );
  for (const name of [
    "file_name",
    "duplicate_count",
    "merged_count",
    "excluded_count",
    "unknown_count",
  ]) {
    if (!batchColumns.has(name)) {
      const declaration =
        name === "file_name"
          ? "TEXT NOT NULL DEFAULT ''"
          : "REAL NOT NULL DEFAULT 0";
      connection.exec(
        `ALTER TABLE import_batches ADD COLUMN ${name} ${declaration}`,
      );
    }
  }
  connection.exec(`
    CREATE INDEX IF NOT EXISTS transactions_import_batch_idx ON transactions(import_batch_id);
    CREATE INDEX IF NOT EXISTS transactions_fingerprint_idx ON transactions(source_fingerprint);
  `);
}
