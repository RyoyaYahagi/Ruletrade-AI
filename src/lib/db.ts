import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import type {
  Decision,
  DecisionInput,
  SavedReview,
  StockSummary,
  Transaction,
  TransactionInput,
  ReviewComparison,
} from "@/lib/domain";

const globalDb = globalThis as unknown as {
  ruletradeDb?: Database.Database;
};

function getDb() {
  if (globalDb.ruletradeDb) return globalDb.ruletradeDb;

  const databasePath =
    process.env.SQLITE_DATABASE_PATH ||
    path.join(process.cwd(), "data", "ruletrade-mvp.sqlite");

  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initialize(db);

  globalDb.ruletradeDb = db;
  return db;
}

function initialize(db: Database.Database) {
  db.exec(`
    create table if not exists stocks (
      id text primary key,
      ticker text not null unique,
      name text,
      created_at text not null default (datetime('now')),
      updated_at text not null default (datetime('now'))
    );

    create table if not exists decisions (
      id text primary key,
      stock_id text not null references stocks(id) on delete cascade,
      kind text not null,
      raw_text text not null,
      thesis text,
      assumptions_json text not null default '[]',
      exit_conditions_json text not null default '[]',
      add_conditions_json text not null default '[]',
      review_at text,
      created_at text not null default (datetime('now'))
    );

    create table if not exists transactions (
      id text primary key,
      stock_id text not null references stocks(id) on delete cascade,
      side text not null check (side in ('buy', 'sell')),
      traded_at text not null,
      quantity real not null check (quantity > 0),
      price real not null check (price >= 0),
      fees real not null default 0 check (fees >= 0),
      reflection text,
      created_at text not null default (datetime('now'))
    );

    create table if not exists reviews (
      id text primary key,
      stock_id text not null references stocks(id) on delete cascade,
      current_text text not null,
      comparison_json text not null,
      created_at text not null default (datetime('now'))
    );

    create index if not exists idx_decisions_stock_created
      on decisions(stock_id, created_at desc);
    create index if not exists idx_transactions_stock_date
      on transactions(stock_id, traded_at desc);
    create index if not exists idx_reviews_stock_created
      on reviews(stock_id, created_at desc);
    create index if not exists idx_decisions_review_at
      on decisions(review_at);
  `);
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function listStocks(): StockSummary[] {
  const rows = getDb()
    .prepare(`
      select
        s.id,
        s.ticker,
        s.name,
        s.updated_at,
        coalesce((
          select sum(case when t.side = 'buy' then t.quantity else -t.quantity end)
          from transactions t
          where t.stock_id = s.id
        ), 0) as position,
        (
          select d.thesis
          from decisions d
          where d.stock_id = s.id
            and d.thesis is not null
            and trim(d.thesis) <> ''
          order by d.created_at desc
          limit 1
        ) as latest_thesis
      from stocks s
      order by s.updated_at desc
    `)
    .all() as Array<{
    id: string;
    ticker: string;
    name: string | null;
    updated_at: string;
    position: number;
    latest_thesis: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    ticker: row.ticker,
    name: row.name,
    position: Number(row.position || 0),
    latestThesis: row.latest_thesis,
    updatedAt: row.updated_at,
  }));
}

export function listUpcomingReviews() {
  return getDb()
    .prepare(`
      select
        d.id,
        d.stock_id as stockId,
        s.ticker,
        s.name,
        d.review_at as reviewAt,
        d.thesis
      from decisions d
      join stocks s on s.id = d.stock_id
      where d.review_at is not null
      order by d.review_at asc
      limit 8
    `)
    .all() as Array<{
    id: string;
    stockId: string;
    ticker: string;
    name: string | null;
    reviewAt: string;
    thesis: string | null;
  }>;
}

export function getStock(stockId: string) {
  return (
    (getDb()
      .prepare("select id, ticker, name, created_at as createdAt, updated_at as updatedAt from stocks where id = ?")
      .get(stockId) as
      | {
          id: string;
          ticker: string;
          name: string | null;
          createdAt: string;
          updatedAt: string;
        }
      | undefined) ?? null
  );
}

export function listDecisions(stockId: string): Decision[] {
  const rows = getDb()
    .prepare(`
      select
        d.*,
        s.ticker,
        s.name as company_name
      from decisions d
      join stocks s on s.id = d.stock_id
      where d.stock_id = ?
      order by d.created_at desc
    `)
    .all(stockId) as Array<{
    id: string;
    stock_id: string;
    ticker: string;
    company_name: string | null;
    kind: Decision["kind"];
    raw_text: string;
    thesis: string | null;
    assumptions_json: string;
    exit_conditions_json: string;
    add_conditions_json: string;
    review_at: string | null;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    stockId: row.stock_id,
    ticker: row.ticker,
    companyName: row.company_name,
    kind: row.kind,
    rawText: row.raw_text,
    thesis: row.thesis,
    assumptions: parseStringArray(row.assumptions_json),
    exitConditions: parseStringArray(row.exit_conditions_json),
    addConditions: parseStringArray(row.add_conditions_json),
    reviewAt: row.review_at,
    createdAt: row.created_at,
  }));
}

export function listTransactions(stockId: string): Transaction[] {
  const rows = getDb()
    .prepare(`
      select
        id,
        stock_id,
        side,
        traded_at,
        quantity,
        price,
        fees,
        reflection,
        created_at
      from transactions
      where stock_id = ?
      order by traded_at desc, created_at desc
    `)
    .all(stockId) as Array<{
    id: string;
    stock_id: string;
    side: "buy" | "sell";
    traded_at: string;
    quantity: number;
    price: number;
    fees: number;
    reflection: string | null;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    stockId: row.stock_id,
    side: row.side,
    tradedAt: row.traded_at,
    quantity: Number(row.quantity),
    price: Number(row.price),
    fees: Number(row.fees),
    reflection: row.reflection,
    createdAt: row.created_at,
  }));
}

export function listReviews(stockId: string): SavedReview[] {
  const rows = getDb()
    .prepare(`
      select id, stock_id, current_text, comparison_json, created_at
      from reviews
      where stock_id = ?
      order by created_at desc
    `)
    .all(stockId) as Array<{
    id: string;
    stock_id: string;
    current_text: string;
    comparison_json: string;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    stockId: row.stock_id,
    currentText: row.current_text,
    comparison: JSON.parse(row.comparison_json) as ReviewComparison,
    createdAt: row.created_at,
  }));
}

export function createDecision(input: DecisionInput) {
  const db = getDb();

  return db.transaction(() => {
    const ticker = input.ticker.trim().toUpperCase();
    const existing = db
      .prepare("select id, name from stocks where ticker = ?")
      .get(ticker) as { id: string; name: string | null } | undefined;

    const stockId = existing?.id || randomUUID();

    if (!existing) {
      db.prepare(
        "insert into stocks (id, ticker, name) values (?, ?, ?)",
      ).run(stockId, ticker, input.companyName);
    } else if (input.companyName && input.companyName !== existing.name) {
      db.prepare(
        "update stocks set name = ?, updated_at = datetime('now') where id = ?",
      ).run(input.companyName, stockId);
    }

    const decisionId = randomUUID();
    db.prepare(`
      insert into decisions (
        id,
        stock_id,
        kind,
        raw_text,
        thesis,
        assumptions_json,
        exit_conditions_json,
        add_conditions_json,
        review_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      decisionId,
      stockId,
      input.kind,
      input.rawText,
      input.thesis,
      JSON.stringify(input.assumptions),
      JSON.stringify(input.exitConditions),
      JSON.stringify(input.addConditions),
      input.reviewAt,
    );

    db.prepare(
      "update stocks set updated_at = datetime('now') where id = ?",
    ).run(stockId);

    return { stockId, decisionId };
  })();
}

export function createTransaction(input: TransactionInput) {
  const db = getDb();
  const stock = db
    .prepare("select id from stocks where id = ?")
    .get(input.stockId);

  if (!stock) throw new Error("Stock not found.");

  const id = randomUUID();
  db.prepare(`
    insert into transactions (
      id,
      stock_id,
      side,
      traded_at,
      quantity,
      price,
      fees,
      reflection
    ) values (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.stockId,
    input.side,
    input.tradedAt,
    input.quantity,
    input.price,
    input.fees,
    input.reflection,
  );

  db.prepare(
    "update stocks set updated_at = datetime('now') where id = ?",
  ).run(input.stockId);

  return { id };
}

export function saveReview(
  stockId: string,
  currentText: string,
  comparison: ReviewComparison,
) {
  const db = getDb();
  const stock = db
    .prepare("select id from stocks where id = ?")
    .get(stockId);

  if (!stock) throw new Error("Stock not found.");

  const id = randomUUID();
  db.prepare(
    "insert into reviews (id, stock_id, current_text, comparison_json) values (?, ?, ?, ?)",
  ).run(id, stockId, currentText, JSON.stringify(comparison));

  db.prepare(
    "update stocks set updated_at = datetime('now') where id = ?",
  ).run(stockId);

  return { id };
}
