import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any */

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

type SqliteValue = string | number | null;
export type LooseRow = { id: string; [key: string]: any };
type LooseRows = LooseRow[] & LooseRow;
type QueryResult<T = Record<string, unknown>> = {
  data: T | T[] | null;
  error: { message: string } | null;
};
type LooseQueryResult = {
  data: LooseRows | null;
  error: { message: string } | null;
};
type LooseQuery = PromiseLike<LooseQueryResult> & {
  select(columns?: string): LooseQuery;
  insert(payload: unknown): LooseQuery;
  upsert(payload: unknown, options?: unknown): LooseQuery;
  update(payload: unknown): LooseQuery;
  eq(column: string, value: unknown): LooseQuery;
  contains(column: string, values: unknown[]): LooseQuery;
  order(column: string, options?: { ascending?: boolean }): LooseQuery;
  limit(maxRows: number): LooseQuery;
  single(): Promise<LooseQueryResult>;
  maybeSingle(): Promise<LooseQueryResult>;
};
export type LooseDbClient = {
  auth: {
    getUser(): Promise<{ data: { user: any }; error: null }>;
    exchangeCodeForSession(code?: string): Promise<{ data: null; error: null }>;
    signInWithPassword(input: any): Promise<{ data: any; error: null }>;
    signInAnonymously(): Promise<{ data: any; error: null }>;
    signUp(input: any): Promise<{ data: any; error: null }>;
    signOut?(): Promise<{ error: null }>;
  };
  from(table: string): LooseQuery;
  rpc(
    name: string,
    params: Record<string, unknown>,
  ): Promise<{ data: number | null; error: { message: string } | null }>;
};

const jsonColumns = new Set([
  "actual_json",
  "answer_json",
  "details",
  "error_details",
  "expected_json",
  "input_json",
  "metadata",
  "missing_checks",
  "matched_checks",
  "extra_checks",
  "options",
  "output_json",
  "profile_json",
  "review_json",
  "rule_json",
  "tags",
]);

const booleanColumns = new Set([
  "can_finalize",
  "is_active",
  "is_required",
  "needs_more_info",
  "retryable",
  "safety_passed",
  "schema_valid",
]);

const tableColumns: Record<string, string[]> = {
  app_users: ["id", "email", "display_name", "created_at", "updated_at"],
  investor_profiles: [
    "id",
    "user_id",
    "experience_level",
    "investment_style",
    "risk_tolerance",
    "cash_buffer_range",
    "max_position_percent",
    "max_loss_percent",
    "preferred_question_style",
    "profile_json",
    "created_at",
    "updated_at",
  ],
  rule_design_sessions: [
    "id",
    "user_id",
    "ticker",
    "company_name",
    "market",
    "currency",
    "status",
    "template_key",
    "rule_json",
    "completion_score",
    "quality_gate_status",
    "question_count",
    "max_question_count",
    "last_reviewed_at",
    "finalized_at",
    "created_at",
    "updated_at",
  ],
  rule_versions: [
    "id",
    "user_id",
    "session_id",
    "version_number",
    "rule_json",
    "change_reason",
    "created_by",
    "created_at",
  ],
  rule_questions: [
    "id",
    "user_id",
    "session_id",
    "question_key",
    "question_text",
    "question_type",
    "options",
    "help_text",
    "priority",
    "is_required",
    "maps_to_rule_field",
    "source",
    "status",
    "display_order",
    "created_at",
    "answered_at",
  ],
  rule_answers: [
    "id",
    "user_id",
    "session_id",
    "question_id",
    "question_key",
    "answer_text",
    "answer_json",
    "created_at",
  ],
  rule_reviews: [
    "id",
    "user_id",
    "session_id",
    "rule_version_id",
    "ai_run_log_id",
    "provider",
    "model",
    "prompt_version",
    "review_json",
    "summary",
    "completion_score",
    "needs_more_info",
    "can_finalize",
    "safety_passed",
    "schema_valid",
    "input_tokens",
    "output_tokens",
    "estimated_cost_usd",
    "latency_ms",
    "error_message",
    "created_at",
  ],
  rule_quality_checks: [
    "id",
    "user_id",
    "session_id",
    "review_id",
    "check_key",
    "label",
    "status",
    "severity",
    "reason",
    "suggested_question",
    "created_at",
  ],
  model_pricing_configs: [
    "id",
    "provider",
    "model",
    "input_cost_per_1m_tokens_usd",
    "output_cost_per_1m_tokens_usd",
    "effective_from",
    "is_active",
    "created_at",
    "updated_at",
  ],
  ai_run_logs: [
    "id",
    "user_id",
    "request_id",
    "task_type",
    "source_type",
    "source_id",
    "session_id",
    "rule_review_id",
    "provider",
    "model",
    "prompt_version",
    "status",
    "schema_valid",
    "safety_passed",
    "input_tokens",
    "output_tokens",
    "estimated_cost_usd",
    "latency_ms",
    "input_json",
    "output_json",
    "error_code",
    "error_message",
    "error_details",
    "metadata",
    "started_at",
    "completed_at",
    "created_at",
  ],
  ai_run_log_events: [
    "id",
    "ai_run_log_id",
    "user_id",
    "event_type",
    "message",
    "metadata",
    "created_at",
  ],
  eval_cases: [
    "id",
    "case_key",
    "title",
    "description",
    "task_type",
    "input_json",
    "expected_json",
    "tags",
    "difficulty",
    "is_active",
    "created_at",
    "updated_at",
  ],
  eval_runs: [
    "id",
    "run_name",
    "task_type",
    "provider",
    "model",
    "prompt_version",
    "status",
    "total_cases",
    "passed_cases",
    "failed_cases",
    "precision",
    "recall",
    "f1",
    "schema_valid_rate",
    "safety_pass_rate",
    "avg_latency_ms",
    "total_estimated_cost_usd",
    "metadata",
    "started_at",
    "completed_at",
    "created_at",
  ],
  eval_run_results: [
    "id",
    "eval_run_id",
    "eval_case_id",
    "ai_run_log_id",
    "status",
    "actual_json",
    "expected_json",
    "matched_checks",
    "missing_checks",
    "extra_checks",
    "true_positive",
    "false_positive",
    "false_negative",
    "precision",
    "recall",
    "f1",
    "schema_valid",
    "safety_passed",
    "latency_ms",
    "estimated_cost_usd",
    "error_code",
    "error_message",
    "created_at",
  ],
  api_error_logs: [
    "id",
    "user_id",
    "request_id",
    "route",
    "method",
    "error_code",
    "error_message",
    "status_code",
    "retryable",
    "details",
    "metadata",
    "created_at",
  ],
  rate_limit_counters: [
    "id",
    "user_id",
    "limit_key",
    "period_start",
    "period_end",
    "used_count",
    "metadata",
    "created_at",
    "updated_at",
  ],
  cost_limit_counters: [
    "id",
    "user_id",
    "period_start",
    "period_end",
    "used_cost_usd",
    "limit_cost_usd",
    "metadata",
    "created_at",
    "updated_at",
  ],
};

let db: Database.Database | null = null;

function now() {
  return new Date().toISOString();
}

function databasePath() {
  const filename = process.env.SQLITE_DATABASE_FILENAME ?? "ruletrade-mvp.sqlite";
  return path.join(process.cwd(), ".data", path.basename(filename));
}

function getDatabase() {
  if (db) return db;

  const filePath = databasePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  seed(db);
  return db;
}

function migrate(database: Database.Database) {
  database.exec(`
    create table if not exists app_users (
      id text primary key,
      email text,
      display_name text,
      created_at text not null default (datetime('now')),
      updated_at text not null default (datetime('now'))
    );

    create table if not exists investor_profiles (
      id text primary key,
      user_id text not null,
      experience_level text not null default 'beginner',
      investment_style text,
      risk_tolerance text,
      cash_buffer_range text,
      max_position_percent real,
      max_loss_percent real,
      preferred_question_style text not null default 'guided',
      profile_json text not null default '{}',
      created_at text not null default (datetime('now')),
      updated_at text not null default (datetime('now')),
      unique (user_id)
    );

    create table if not exists rule_design_sessions (
      id text primary key,
      user_id text not null,
      ticker text not null,
      company_name text,
      market text,
      currency text default 'JPY',
      status text not null default 'draft',
      template_key text,
      rule_json text not null default '{}',
      completion_score integer,
      quality_gate_status text,
      question_count integer not null default 0,
      max_question_count integer not null default 12,
      last_reviewed_at text,
      finalized_at text,
      created_at text not null default (datetime('now')),
      updated_at text not null default (datetime('now'))
    );

    create table if not exists rule_versions (
      id text primary key,
      user_id text not null,
      session_id text not null,
      version_number integer not null,
      rule_json text not null,
      change_reason text,
      created_by text not null default 'user',
      created_at text not null default (datetime('now')),
      unique (session_id, version_number)
    );

    create table if not exists rule_questions (
      id text primary key,
      user_id text not null,
      session_id text not null,
      question_key text not null,
      question_text text not null,
      question_type text not null,
      options text,
      help_text text,
      priority integer not null default 1,
      is_required integer not null default 1,
      maps_to_rule_field text,
      source text not null default 'ai',
      status text not null default 'pending',
      display_order integer not null default 0,
      created_at text not null default (datetime('now')),
      answered_at text
    );

    create table if not exists rule_answers (
      id text primary key,
      user_id text not null,
      session_id text not null,
      question_id text,
      question_key text not null,
      answer_text text,
      answer_json text not null default '{}',
      created_at text not null default (datetime('now'))
    );

    create table if not exists rule_reviews (
      id text primary key,
      user_id text not null,
      session_id text not null,
      rule_version_id text,
      ai_run_log_id text,
      provider text not null,
      model text not null,
      prompt_version text not null,
      review_json text not null,
      summary text,
      completion_score integer,
      needs_more_info integer not null default 1,
      can_finalize integer not null default 0,
      safety_passed integer not null default 1,
      schema_valid integer not null default 1,
      input_tokens integer,
      output_tokens integer,
      estimated_cost_usd real,
      latency_ms integer,
      error_message text,
      created_at text not null default (datetime('now'))
    );

    create table if not exists rule_quality_checks (
      id text primary key,
      user_id text not null,
      session_id text not null,
      review_id text,
      check_key text not null,
      label text not null,
      status text not null,
      severity text not null,
      reason text not null,
      suggested_question text,
      created_at text not null default (datetime('now'))
    );

    create table if not exists model_pricing_configs (
      id text primary key,
      provider text not null,
      model text not null,
      input_cost_per_1m_tokens_usd real not null default 0,
      output_cost_per_1m_tokens_usd real not null default 0,
      effective_from text,
      is_active integer not null default 1,
      created_at text not null default (datetime('now')),
      updated_at text not null default (datetime('now')),
      unique (provider, model)
    );

    create table if not exists ai_run_logs (
      id text primary key,
      user_id text not null,
      request_id text,
      task_type text not null,
      source_type text,
      source_id text,
      session_id text,
      rule_review_id text,
      provider text not null,
      model text not null,
      prompt_version text,
      status text not null default 'started',
      schema_valid integer,
      safety_passed integer,
      input_tokens integer,
      output_tokens integer,
      estimated_cost_usd real,
      latency_ms integer,
      input_json text,
      output_json text,
      error_code text,
      error_message text,
      error_details text,
      metadata text not null default '{}',
      started_at text not null default (datetime('now')),
      completed_at text,
      created_at text not null default (datetime('now'))
    );

    create table if not exists ai_run_log_events (
      id text primary key,
      ai_run_log_id text not null,
      user_id text not null,
      event_type text not null,
      message text,
      metadata text not null default '{}',
      created_at text not null default (datetime('now'))
    );

    create table if not exists eval_cases (
      id text primary key,
      case_key text not null unique,
      title text not null,
      description text,
      task_type text not null,
      input_json text not null,
      expected_json text not null,
      tags text not null default '[]',
      difficulty text not null default 'medium',
      is_active integer not null default 1,
      created_at text not null default (datetime('now')),
      updated_at text not null default (datetime('now'))
    );

    create table if not exists eval_runs (
      id text primary key,
      run_name text,
      task_type text not null,
      provider text not null,
      model text not null,
      prompt_version text not null,
      status text not null default 'running',
      total_cases integer not null default 0,
      passed_cases integer not null default 0,
      failed_cases integer not null default 0,
      precision real,
      recall real,
      f1 real,
      schema_valid_rate real,
      safety_pass_rate real,
      avg_latency_ms real,
      total_estimated_cost_usd real,
      metadata text not null default '{}',
      started_at text not null default (datetime('now')),
      completed_at text,
      created_at text not null default (datetime('now'))
    );

    create table if not exists eval_run_results (
      id text primary key,
      eval_run_id text not null,
      eval_case_id text not null,
      ai_run_log_id text,
      status text not null,
      actual_json text,
      expected_json text not null,
      matched_checks text not null default '[]',
      missing_checks text not null default '[]',
      extra_checks text not null default '[]',
      true_positive integer not null default 0,
      false_positive integer not null default 0,
      false_negative integer not null default 0,
      precision real,
      recall real,
      f1 real,
      schema_valid integer,
      safety_passed integer,
      latency_ms integer,
      estimated_cost_usd real,
      error_code text,
      error_message text,
      created_at text not null default (datetime('now')),
      unique (eval_run_id, eval_case_id)
    );

    create table if not exists api_error_logs (
      id text primary key,
      user_id text,
      request_id text not null,
      route text,
      method text,
      error_code text not null,
      error_message text not null,
      status_code integer not null,
      retryable integer not null default 0,
      details text,
      metadata text not null default '{}',
      created_at text not null default (datetime('now'))
    );

    create table if not exists rate_limit_counters (
      id text primary key,
      user_id text not null,
      limit_key text not null,
      period_start text not null,
      period_end text not null,
      used_count integer not null default 0,
      metadata text not null default '{}',
      created_at text not null default (datetime('now')),
      updated_at text not null default (datetime('now')),
      unique (user_id, limit_key, period_start, period_end)
    );

    create table if not exists cost_limit_counters (
      id text primary key,
      user_id text not null,
      period_start text not null,
      period_end text not null,
      used_cost_usd real not null default 0,
      limit_cost_usd real not null default 1,
      metadata text not null default '{}',
      created_at text not null default (datetime('now')),
      updated_at text not null default (datetime('now')),
      unique (user_id, period_start, period_end)
    );

    create index if not exists idx_rule_design_sessions_user_updated
      on rule_design_sessions(user_id, updated_at desc);
    create index if not exists idx_rule_questions_session_order
      on rule_questions(session_id, display_order, created_at);
    create index if not exists idx_rule_reviews_session_created
      on rule_reviews(session_id, created_at desc);
  `);
}

function seed(database: Database.Database) {
  const nowIso = now();
  const pricingRows = [
    ["mock", "mock-model", 0, 0],
    ["openai", process.env.OPENAI_MODEL ?? "gpt-5.4-mini", 0, 0],
    ["gemini", process.env.GEMINI_MODEL ?? "gemini-3-pro-preview", 0, 0],
    ["codex", process.env.OPENAI_CODEX_MODEL ?? "gpt-5.4-mini", 0, 0],
    [
      "codex-app-server",
      process.env.CODEX_APP_SERVER_MODEL ?? "gpt-5.4-mini",
      0,
      0,
    ],
  ];
  const stmt = database.prepare(`
    insert into model_pricing_configs (
      id, provider, model, input_cost_per_1m_tokens_usd,
      output_cost_per_1m_tokens_usd, effective_from, is_active, created_at, updated_at
    )
    values (?, ?, ?, ?, ?, ?, 1, ?, ?)
    on conflict(provider, model) do nothing
  `);
  for (const row of pricingRows) {
    stmt.run(crypto.randomUUID(), ...row, nowIso, nowIso, nowIso);
  }
}

function serializeValue(column: string, value: unknown): SqliteValue {
  if (value === undefined) return null;
  if (value === null) return null;
  if (jsonColumns.has(column)) return JSON.stringify(value);
  if (booleanColumns.has(column)) return value ? 1 : 0;
  if (typeof value === "number" || typeof value === "string") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  return JSON.stringify(value);
}

function deserializeValue(column: string, value: unknown) {
  if (value === null || value === undefined) return null;
  if (jsonColumns.has(column)) {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  if (booleanColumns.has(column)) return Boolean(value);
  return value;
}

function deserializeRow(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).map(([column, value]) => [
      column,
      deserializeValue(column, value),
    ]),
  );
}

function columnsForSelect(table: string, selectColumns: string | null) {
  if (!selectColumns || selectColumns.trim() === "*") return "*";
  const known = tableColumns[table] ?? [];
  const selected = selectColumns
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean)
    .map((column) => column.split(/\s+/)[0])
    .filter((column) => known.includes(column));
  return selected.length > 0 ? selected.join(", ") : "*";
}

class SqliteQueryBuilder {
  private mode: "select" | "insert" | "upsert" | "update" = "select";
  private selectColumns: string | null = null;
  private payload: Record<string, unknown> | Record<string, unknown>[] | null =
    null;
  private filters: Array<{ column: string; value: unknown }> = [];
  private containsFilters: Array<{ column: string; values: unknown[] }> = [];
  private orders: Array<{ column: string; ascending: boolean }> = [];
  private maxRows: number | null = null;
  private resultMode: "many" | "single" | "maybeSingle" = "many";

  constructor(private readonly table: string) {}

  select(columns = "*") {
    this.selectColumns = columns;
    return this;
  }

  insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
    this.mode = "insert";
    this.payload = payload;
    return this;
  }

  upsert(payload: Record<string, unknown> | Record<string, unknown>[]) {
    this.mode = "upsert";
    this.payload = payload;
    return this;
  }

  update(payload: Record<string, unknown>) {
    this.mode = "update";
    this.payload = payload;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  contains(column: string, values: unknown[]) {
    this.containsFilters.push({ column, values });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending ?? true });
    return this;
  }

  limit(maxRows: number) {
    this.maxRows = maxRows;
    return this;
  }

  single() {
    this.resultMode = "single";
    return this.execute();
  }

  maybeSingle() {
    this.resultMode = "maybeSingle";
    return this.execute();
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private execute(): Promise<QueryResult> {
    try {
      const database = getDatabase();

      if (this.mode === "insert" || this.mode === "upsert") {
        const rows = Array.isArray(this.payload)
          ? this.payload
          : [this.payload ?? {}];
        const inserted = rows.map((row) => this.insertRow(database, row));
        return Promise.resolve(this.shapeResult(inserted));
      }

      if (this.mode === "update") {
        this.updateRows(database, this.payload as Record<string, unknown>);
        const rows = this.selectRows(database);
        return Promise.resolve(this.shapeResult(rows));
      }

      const rows = this.selectRows(database);
      return Promise.resolve(this.shapeResult(rows));
    } catch (error) {
      return Promise.resolve({
        data: null,
        error: {
          message:
            error instanceof Error ? error.message : "SQLite query failed",
        },
      });
    }
  }

  private insertRow(
    database: Database.Database,
    payload: Record<string, unknown>,
  ) {
    const knownColumns = tableColumns[this.table] ?? Object.keys(payload);
    const row: Record<string, unknown> = {
      ...payload,
      id: payload.id ?? crypto.randomUUID(),
    };
    const timestamp = now();
    if (knownColumns.includes("created_at") && row.created_at === undefined) {
      row.created_at = timestamp;
    }
    if (knownColumns.includes("updated_at") && row.updated_at === undefined) {
      row.updated_at = timestamp;
    }

    const columns = Object.keys(row).filter((column) =>
      knownColumns.includes(column),
    );
    const placeholders = columns.map(() => "?").join(", ");
    const conflict =
      this.mode === "upsert"
        ? ` on conflict(id) do update set ${columns
            .filter((column) => column !== "id")
            .map((column) => `${column}=excluded.${column}`)
            .join(", ")}`
        : "";
    database
      .prepare(
        `insert into ${this.table} (${columns.join(", ")}) values (${placeholders})${conflict}`,
      )
      .run(...columns.map((column) => serializeValue(column, row[column])));
    const inserted = database
      .prepare(`select * from ${this.table} where id = ?`)
      .get(row.id) as Record<string, unknown>;
    return deserializeRow(inserted);
  }

  private updateRows(
    database: Database.Database,
    payload: Record<string, unknown>,
  ) {
    const knownColumns = tableColumns[this.table] ?? Object.keys(payload);
    const row = { ...payload };
    if (knownColumns.includes("updated_at")) row.updated_at = now();
    const columns = Object.keys(row).filter((column) =>
      knownColumns.includes(column),
    );
    if (columns.length === 0) return;
    const where = this.whereClause();
    database
      .prepare(
        `update ${this.table} set ${columns
          .map((column) => `${column} = ?`)
          .join(", ")} ${where.sql}`,
      )
      .run(
        ...columns.map((column) => serializeValue(column, row[column])),
        ...where.values,
      );
  }

  private selectRows(database: Database.Database) {
    const columns = columnsForSelect(this.table, this.selectColumns);
    const where = this.whereClause();
    const order =
      this.orders.length > 0
        ? ` order by ${this.orders
            .map(
              (item) => `${item.column} ${item.ascending ? "asc" : "desc"}`,
            )
            .join(", ")}`
        : "";
    const limit = this.maxRows ? ` limit ${this.maxRows}` : "";
    const rows = database
      .prepare(`select ${columns} from ${this.table} ${where.sql}${order}${limit}`)
      .all(...where.values) as Record<string, unknown>[];
    return rows.map(deserializeRow).filter((row) => {
      return this.containsFilters.every(({ column, values }) => {
        const actual = row[column];
        return (
          Array.isArray(actual) &&
          values.every((value) => actual.includes(value))
        );
      });
    });
  }

  private whereClause() {
    if (this.filters.length === 0) return { sql: "", values: [] as SqliteValue[] };
    return {
      sql: `where ${this.filters.map(({ column }) => `${column} = ?`).join(" and ")}`,
      values: this.filters.map(({ column, value }) => serializeValue(column, value)),
    };
  }

  private shapeResult(rows: Record<string, unknown>[]): QueryResult {
    if (this.resultMode === "single") {
      if (rows.length !== 1) {
        return { data: null, error: { message: "Expected exactly one row" } };
      }
      return { data: rows[0], error: null };
    }
    if (this.resultMode === "maybeSingle") {
      if (rows.length > 1) {
        return { data: null, error: { message: "Expected at most one row" } };
      }
      return { data: rows[0] ?? null, error: null };
    }
    return { data: rows, error: null };
  }
}

export function createSqliteClient(): LooseDbClient {
  return {
    auth: {
      async getUser() {
        return {
          data: {
            user: {
              id: process.env.MOCK_AUTH_USER_ID ?? "mvp-user-id",
              email: process.env.MOCK_AUTH_EMAIL ?? "mvp@example.local",
              app_metadata: { role: "admin" },
              user_metadata: {},
              aud: "authenticated",
              created_at: now(),
            },
          },
          error: null,
        };
      },
      async exchangeCodeForSession() {
        return { data: null, error: null };
      },
      async signInWithPassword() {
        return { data: { user: null, session: null }, error: null };
      },
      async signInAnonymously() {
        return { data: { user: null, session: null }, error: null };
      },
      async signUp() {
        return { data: { user: null, session: null }, error: null };
      },
      async signOut() {
        return { error: null };
      },
    },
    from(table: string) {
      return new SqliteQueryBuilder(table) as unknown as LooseQuery;
    },
    async rpc(name: string, params: Record<string, unknown>) {
      const database = getDatabase();
      if (name === "increment_rate_limit_counter") {
        const id = crypto.randomUUID();
        database
          .prepare(
            `insert into rate_limit_counters (
              id, user_id, limit_key, period_start, period_end, used_count, metadata, created_at, updated_at
            ) values (?, ?, ?, ?, ?, ?, '{}', ?, ?)
            on conflict(user_id, limit_key, period_start, period_end)
            do update set used_count = used_count + excluded.used_count, updated_at = excluded.updated_at`,
          )
          .run(
            id,
            params.p_user_id,
            params.p_limit_key,
            params.p_period_start,
            params.p_period_end,
            params.p_increment_by ?? 1,
            now(),
            now(),
          );
        const row = database
          .prepare(
            `select used_count from rate_limit_counters
             where user_id = ? and limit_key = ? and period_start = ? and period_end = ?`,
          )
          .get(
            params.p_user_id,
            params.p_limit_key,
            params.p_period_start,
            params.p_period_end,
          ) as { used_count: number };
        return { data: row.used_count, error: null };
      }

      if (name === "increment_cost_limit_counter") {
        const id = crypto.randomUUID();
        database
          .prepare(
            `insert into cost_limit_counters (
              id, user_id, period_start, period_end, used_cost_usd, limit_cost_usd, metadata, created_at, updated_at
            ) values (?, ?, ?, ?, ?, 1, '{}', ?, ?)
            on conflict(user_id, period_start, period_end)
            do update set used_cost_usd = used_cost_usd + excluded.used_cost_usd, updated_at = excluded.updated_at`,
          )
          .run(
            id,
            params.p_user_id,
            params.p_period_start,
            params.p_period_end,
            params.p_cost_usd ?? 0,
            now(),
            now(),
          );
        const row = database
          .prepare(
            `select used_cost_usd from cost_limit_counters
             where user_id = ? and period_start = ? and period_end = ?`,
          )
          .get(
            params.p_user_id,
            params.p_period_start,
            params.p_period_end,
          ) as { used_cost_usd: number };
        return { data: row.used_cost_usd, error: null };
      }

      return { data: null, error: { message: `Unknown SQLite RPC: ${name}` } };
    },
  };
}
