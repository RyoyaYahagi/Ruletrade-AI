import "server-only";

import type Database from "better-sqlite3";

const schemaStatements = [
  `create table if not exists app_users (
    id text primary key,
    email text,
    display_name text,
    role text not null default 'user',
    created_at text not null default (datetime('now')),
    updated_at text not null default (datetime('now'))
  )`,
  `create table if not exists auth_credentials (
    user_id text primary key,
    email text not null unique,
    password_hash text not null,
    created_at text not null default (datetime('now'))
  )`,
  `create table if not exists auth_sessions (
    token_hash text primary key,
    user_id text not null,
    expires_at text not null,
    created_at text not null default (datetime('now'))
  )`,
  `create table if not exists user_ui_preferences (
    id text primary key,
    user_id text not null unique,
    locale text not null default 'ja',
    timezone text not null default 'Asia/Tokyo',
    color_scheme text not null default 'system',
    reduced_motion integer not null default 0,
    high_contrast integer not null default 0,
    larger_text integer not null default 0,
    compact_mode integer not null default 0,
    show_advanced_fields integer not null default 0,
    ai_provider text,
    ai_model text,
    created_at text not null default (datetime('now')),
    updated_at text not null default (datetime('now'))
  )`,
  `create table if not exists rule_design_sessions (
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
  )`,
  `create table if not exists rule_versions (
    id text primary key,
    user_id text not null,
    session_id text not null,
    version_number integer not null,
    rule_json text not null,
    change_reason text,
    created_by text not null default 'user',
    created_at text not null default (datetime('now')),
    unique (session_id, version_number)
  )`,
  `create table if not exists rule_questions (
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
  )`,
  `create table if not exists rule_answers (
    id text primary key,
    user_id text not null,
    session_id text not null,
    question_id text,
    question_key text not null,
    answer_text text,
    answer_json text not null default '{}',
    created_at text not null default (datetime('now'))
  )`,
  `create table if not exists rule_reviews (
    id text primary key,
    user_id text not null,
    session_id text not null,
    rule_version_id text,
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
  )`,
  `create table if not exists rule_quality_checks (
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
  )`,
  `create table if not exists price_quotes (
    id text primary key,
    symbol text not null,
    market text not null default 'JP',
    quote_date text not null,
    close_price real not null,
    currency text not null default 'JPY',
    source text not null,
    created_at text not null default (datetime('now')),
    unique (symbol, market, quote_date)
  )`,
  `create table if not exists fx_rates (
    id text primary key,
    pair text not null,
    rate_date text not null,
    rate real not null,
    source text not null,
    created_at text not null default (datetime('now')),
    unique (pair, rate_date)
  )`,
  `create index if not exists idx_rule_design_sessions_user_created on rule_design_sessions(user_id, created_at desc)`,
  `create index if not exists idx_rule_questions_session_order on rule_questions(session_id, display_order, created_at)`,
  `create index if not exists idx_rule_answers_session_created on rule_answers(session_id, created_at)`,
  `create index if not exists idx_rule_reviews_session_created on rule_reviews(session_id, created_at desc)`,
  `create index if not exists idx_rule_quality_checks_review on rule_quality_checks(review_id)`,
  `create index if not exists idx_price_quotes_symbol_date on price_quotes(symbol, market, quote_date desc)`,
  `create index if not exists idx_auth_sessions_user on auth_sessions(user_id)`,
  `create index if not exists idx_auth_sessions_expiry on auth_sessions(expires_at)`,
];

export function initializeSqliteSchema(db: Database.Database) {
  db.pragma("foreign_keys = on");
  db.pragma("journal_mode = WAL");

  const migrate = db.transaction(() => {
    for (const statement of schemaStatements) {
      db.prepare(statement).run();
    }
  });

  migrate();
  ensureColumn(db, "app_users", "role", "text not null default 'user'");
  ensureColumn(db, "user_ui_preferences", "ai_provider", "text");
  ensureColumn(db, "user_ui_preferences", "ai_model", "text");
}

function ensureColumn(
  db: Database.Database,
  table: string,
  column: string,
  definition: string,
) {
  const columns = db
    .prepare(`pragma table_info("${table.replaceAll('"', '""')}")`)
    .all() as Array<{ name: string }>;

  if (columns.some((candidate) => candidate.name === column)) return;
  db.prepare(
    `alter table "${table.replaceAll('"', '""')}" add column "${column.replaceAll('"', '""')}" ${definition}`,
  ).run();
}
