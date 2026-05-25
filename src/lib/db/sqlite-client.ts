import "server-only";

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { initializeSqliteSchema } from "@/lib/db/sqlite-schema";

type Row = Record<string, unknown>;

let db: Database.Database | null = null;

export function getSqliteDatabase() {
  if (db) return db;

  const databasePath =
    process.env.SQLITE_DATABASE_PATH ??
    path.join(process.cwd(), "data", "ruletrade.sqlite");

  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  db = new Database(databasePath);
  initializeSqliteSchema(db);
  return db;
}

export function createSqliteClient() {
  return {
    auth: {
      admin: {
        async deleteUser() {
          return unsupported("Supabase Auth admin is not available with SQLite");
        },
      },
      async exchangeCodeForSession() {
        return unsupported("Supabase Auth callbacks are not available with SQLite");
      },
      async getUser() {
        const email = process.env.MOCK_AUTH_EMAIL;
        if (!email) return { data: { user: null }, error: null };

        return {
          data: {
            user: {
              id: process.env.MOCK_AUTH_USER_ID ?? "mock-user-id",
              email,
              app_metadata: { role: process.env.MOCK_AUTH_ROLE ?? "user" },
              user_metadata: {},
              aud: "authenticated",
              created_at: new Date().toISOString(),
            },
          },
          error: null,
        };
      },
    },
    storage: {
      from() {
        return {
          async upload() {
            return unsupported("Supabase Storage is not available with SQLite");
          },
          async download() {
            return unsupported("Supabase Storage is not available with SQLite");
          },
          async remove() {
            return unsupported("Supabase Storage is not available with SQLite");
          },
          async list() {
            return unsupported("Supabase Storage is not available with SQLite");
          },
        };
      },
    },
    async rpc() {
      return unsupported("Supabase RPC is not available with SQLite");
    },
    from(table: string) {
      return new SqliteQueryBuilder(table);
    },
  };
}

class SqliteQueryBuilder {
  private operation: "select" | "insert" | "update" | "delete" = "select";
  private selectedColumns = "*";
  private filters: Array<{ column: string; value: unknown }> = [];
  private negativeFilters: Array<{ column: string; value: unknown }> = [];
  private rangeFilters: Array<{
    column: string;
    operator: ">=" | ">" | "<=" | "<";
    value: unknown;
  }> = [];
  private inFilters: Array<{ column: string; values: unknown[] }> = [];
  private nullFilters: Array<{ column: string; value: boolean }> = [];
  private orders: Array<{ column: string; ascending: boolean }> = [];
  private limitCount: number | null = null;
  private payload: Row | Row[] | null = null;
  private upsertConflictColumn: string | null = null;
  private requestedCount = false;

  constructor(private readonly table: string) {}

  select(columns = "*", options?: { count?: string; head?: boolean }) {
    this.selectedColumns = columns;
    this.requestedCount = Boolean(options?.count);
    if (options?.head) this.limitCount = 0;
    return this;
  }

  insert(payload: Row | Row[]) {
    this.operation = "insert";
    this.payload = payload;
    return this;
  }

  upsert(payload: Row | Row[], options?: { onConflict?: string }) {
    this.operation = "insert";
    this.payload = payload;
    this.upsertConflictColumn = options?.onConflict ?? "id";
    return this;
  }

  update(payload: Row) {
    this.operation = "update";
    this.payload = payload;
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.negativeFilters.push({ column, value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.rangeFilters.push({ column, operator: ">=", value });
    return this;
  }

  gt(column: string, value: unknown) {
    this.rangeFilters.push({ column, operator: ">", value });
    return this;
  }

  lte(column: string, value: unknown) {
    this.rangeFilters.push({ column, operator: "<=", value });
    return this;
  }

  lt(column: string, value: unknown) {
    this.rangeFilters.push({ column, operator: "<", value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.inFilters.push({ column, values });
    return this;
  }

  is(column: string, value: unknown) {
    this.nullFilters.push({ column, value: value === null });
    return this;
  }

  contains() {
    return this;
  }

  or() {
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending ?? true });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  async single() {
    const result = await this.execute();
    if (result.error) return result;
    const rows = Array.isArray(result.data) ? result.data : [result.data];
    return { data: rows[0] ?? null, error: rows[0] ? null : sqliteError("No rows") };
  }

  async maybeSingle() {
    const result = await this.execute();
    if (result.error) return result;
    const rows = Array.isArray(result.data) ? result.data : [result.data];
    return { data: rows[0] ?? null, error: null };
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute() {
    try {
      if (this.operation === "insert") return this.executeInsert();
      if (this.operation === "update") return this.executeUpdate();
      if (this.operation === "delete") return this.executeDelete();
      return this.executeSelect();
    } catch (error) {
      return { data: null, error };
    }
  }

  private executeInsert() {
    const rows = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
    const normalizedRows = rows.map((row) => normalizeWriteRow(row));
    const database = getSqliteDatabase();

    database.transaction(() => {
      for (const row of normalizedRows) {
        ensureTableForRow(this.table, row);
        const columns = Object.keys(row);
        const placeholders = columns.map((column) => `@${column}`).join(", ");
        const command = this.upsertConflictColumn ? "insert or replace" : "insert";
        database
          .prepare(
            `${command} into ${quoteIdent(this.table)} (${columns
              .map(quoteIdent)
              .join(", ")}) values (${placeholders})`,
          )
          .run(row);
      }
    })();

    return this.executeSelectForWrittenRows(normalizedRows);
  }

  private executeUpdate() {
    const payload = normalizeWriteRow(
      this.payload && !Array.isArray(this.payload) ? this.payload : {},
      false,
    );
    ensureTableForRow(this.table, payload);
    const columns = Object.keys(payload);
    const params = { ...payload, ...this.filterParams() };
    const setSql = columns.map((column) => `${quoteIdent(column)} = @${column}`).join(", ");
    const updateTimeSql = columns.includes("updated_at") ? "" : ", updated_at = datetime('now')";

    getSqliteDatabase()
      .prepare(
        `update ${quoteIdent(this.table)} set ${setSql}${updateTimeSql} ${this.whereSql()}`,
      )
      .run(params);

    return this.executeSelect();
  }

  private executeDelete() {
    ensureTable(this.table);
    getSqliteDatabase()
      .prepare(`delete from ${quoteIdent(this.table)} ${this.whereSql()}`)
      .run(this.filterParams());
    return { data: null, error: null };
  }

  private executeSelectForWrittenRows(rows: Row[]) {
    const firstId = rows[0]?.id;
    if (!firstId) return { data: null, error: null };
    this.filters = [{ column: "id", value: firstId }];
    return this.executeSelect();
  }

  private executeSelect() {
    ensureTable(this.table);
    const sql = [
      `select ${selectSql(this.selectedColumns)} from ${quoteIdent(this.table)}`,
      this.whereSql(),
      this.orderSql(),
      this.limitCount === null ? "" : `limit ${this.limitCount}`,
    ]
      .filter(Boolean)
      .join(" ");

    const rows = getSqliteDatabase()
      .prepare(sql)
      .all(this.filterParams())
      .map(normalizeReadRow);

    return { data: rows, error: null, count: this.requestedCount ? rows.length : null };
  }

  private whereSql() {
    const predicates = [
      ...this.filters.map((filter, index) => `${quoteIdent(filter.column)} = @filter_${index}`),
      ...this.negativeFilters.map(
        (filter, index) => `${quoteIdent(filter.column)} != @negative_filter_${index}`,
      ),
      ...this.rangeFilters.map(
        (filter, index) =>
          `${quoteIdent(filter.column)} ${filter.operator} @range_filter_${index}`,
      ),
      ...this.inFilters.map((filter, index) => {
        if (filter.values.length === 0) return "1 = 0";
        return `${quoteIdent(filter.column)} in (${filter.values
          .map((_value, valueIndex) => `@in_filter_${index}_${valueIndex}`)
          .join(", ")})`;
      }),
      ...this.nullFilters.map(
        (filter) => `${quoteIdent(filter.column)} is ${filter.value ? "" : "not "}null`,
      ),
    ];

    if (predicates.length === 0) return "";
    return `where ${predicates.join(" and ")}`;
  }

  private orderSql() {
    if (this.orders.length === 0) return "";
    return `order by ${this.orders
      .map((order) => `${quoteIdent(order.column)} ${order.ascending ? "asc" : "desc"}`)
      .join(", ")}`;
  }

  private filterParams() {
    return {
      ...Object.fromEntries(
        this.filters.map((filter, index) => [`filter_${index}`, serializeValue(filter.value)]),
      ),
      ...Object.fromEntries(
        this.negativeFilters.map((filter, index) => [
          `negative_filter_${index}`,
          serializeValue(filter.value),
        ]),
      ),
      ...Object.fromEntries(
        this.rangeFilters.map((filter, index) => [
          `range_filter_${index}`,
          serializeValue(filter.value),
        ]),
      ),
      ...Object.fromEntries(
        this.inFilters.flatMap((filter, index) =>
          filter.values.map((value, valueIndex) => [
            `in_filter_${index}_${valueIndex}`,
            serializeValue(value),
          ]),
        ),
      ),
    };
  }
}

function normalizeWriteRow(row: Row, includeId = true): Row {
  const source = includeId ? { id: row.id ?? randomUUID(), ...row } : row;
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, serializeValue(value)]),
  );
}

function normalizeReadRow(row: unknown): Row {
  const result = row as Row;
  return Object.fromEntries(
    Object.entries(result).map(([key, value]) => [key, deserializeValue(key, value)]),
  );
}

function serializeValue(value: unknown) {
  if (value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return value;
}

function deserializeValue(key: string, value: unknown) {
  if (typeof value !== "string") return value;
  if (!key.endsWith("_json") && key !== "options") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function selectSql(columns: string) {
  if (columns.trim() === "*") return "*";
  if (columns.includes("(")) return "*";
  return columns
    .split(",")
    .map((column) => quoteIdent(column.trim()))
    .join(", ");
}

function quoteIdent(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function sqliteError(message: string) {
  return { message, code: "SQLITE_NO_ROWS" };
}

function unsupported(message: string) {
  return { data: null, error: { message, code: "SQLITE_UNSUPPORTED" } };
}

function ensureTableForRow(table: string, row: Row) {
  ensureTable(table);
  const existingColumns = new Set(
    getSqliteDatabase()
      .prepare(`pragma table_info(${quoteIdent(table)})`)
      .all()
      .map((column) => (column as { name: string }).name),
  );

  for (const [column, value] of Object.entries(row)) {
    if (existingColumns.has(column)) continue;
    getSqliteDatabase()
      .prepare(
        `alter table ${quoteIdent(table)} add column ${quoteIdent(column)} ${sqliteType(value)}`,
      )
      .run();
  }
}

function ensureTable(table: string) {
  getSqliteDatabase()
    .prepare(
      `create table if not exists ${quoteIdent(table)} (
        id text primary key,
        created_at text not null default (datetime('now')),
        updated_at text not null default (datetime('now'))
      )`,
    )
    .run();
}

function sqliteType(value: unknown) {
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "real";
  return "text";
}
