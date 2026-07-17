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
  `create table if not exists api_access_tokens (
    id text primary key,
    user_id text not null,
    token_hash text not null,
    label text not null,
    scopes text not null default 'read',
    last_used_at text,
    expires_at text,
    revoked_at text,
    created_at text not null default (datetime('now')),
    unique (token_hash)
  )`,
  `create table if not exists api_tool_audit_logs (
    id text primary key,
    user_id text not null,
    token_id text not null,
    tool_name text not null,
    status text not null,
    latency_ms integer not null,
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
    allow_unknown integer not null default 1,
    unknown_default_json text,
    breaker_source text,
    created_at text not null default (datetime('now')),
    answered_at text
  )`,
  `create table if not exists rule_alert_events (
    id text primary key,
    user_id text not null,
    session_id text not null,
    condition_key text not null,
    quote_date text not null,
    triggered_value real,
    threshold_value real,
    notification_id text,
    resolution text,
    resolved_at text,
    created_at text not null default (datetime('now')),
    unique (session_id, condition_key, quote_date)
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
  `create table if not exists portfolio_targets (
    id text primary key,
    user_id text not null,
    portfolio_id text not null,
    target_type text not null,
    target_key text,
    target_percent real not null,
    tolerance_percent real not null default 5,
    created_at text not null default (datetime('now')),
    updated_at text not null default (datetime('now')),
    unique (portfolio_id, target_type, target_key)
  )`,
  `create table if not exists drift_alert_events (
    id text primary key,
    user_id text not null,
    portfolio_id text not null,
    target_type text not null,
    target_key text not null,
    quote_date text not null,
    status text not null,
    created_at text not null default (datetime('now')),
    unique (portfolio_id, target_type, target_key, quote_date)
  )`,
  `create table if not exists news_items (
    id text primary key,
    source text not null,
    external_id text not null,
    title text not null,
    summary text,
    url text not null,
    published_at text not null,
    content_hash text not null unique,
    created_at text not null default (datetime('now'))
  )`,
  `create table if not exists news_ticker_matches (
    id text primary key,
    news_item_id text not null,
    symbol text not null,
    market text not null default 'JP',
    match_method text not null,
    created_at text not null default (datetime('now')),
    unique (news_item_id, symbol, market)
  )`,
  `create table if not exists news_assessments (
    id text primary key,
    user_id text not null,
    news_item_id text not null,
    session_id text not null,
    relevance text not null,
    thesis_relation text,
    matched_breaker_index integer,
    summary_text text,
    model text,
    estimated_cost_usd real,
    notification_id text,
    created_at text not null default (datetime('now')),
    unique (user_id, news_item_id, session_id)
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
  `create table if not exists holistic_reviews (
    id text primary key,
    user_id text not null,
    period text not null,
    review_json text not null,
    summary_text text not null,
    model text not null,
    estimated_cost_usd real,
    safety_passed integer not null default 1,
    notification_id text,
    created_at text not null default (datetime('now')),
    updated_at text not null default (datetime('now'))
  )`,
  `create table if not exists financial_statements (
    id text primary key,
    ticker text not null,
    market text not null default 'JP',
    fiscal_period text not null,
    revenue real,
    operating_income real,
    net_income real,
    eps real,
    dividend_per_share real,
    equity_ratio real,
    currency text not null default 'JPY',
    source text not null,
    filed_at text,
    created_at text not null default (datetime('now')),
    unique (ticker, market, fiscal_period, source)
  )`,
  `create table if not exists knowledge_articles (
    id text primary key,
    title text not null,
    body text not null,
    topic_keys text not null default '[]',
    author_name text not null,
    source_name text,
    source_url text,
    license_note text not null,
    published_at text,
    is_active integer not null default 1,
    created_at text not null default (datetime('now')),
    updated_at text not null default (datetime('now'))
  )`,
  `create index if not exists idx_rule_design_sessions_user_created on rule_design_sessions(user_id, created_at desc)`,
  `create index if not exists idx_rule_questions_session_order on rule_questions(session_id, display_order, created_at)`,
  `create index if not exists idx_rule_answers_session_created on rule_answers(session_id, created_at)`,
  `create index if not exists idx_rule_reviews_session_created on rule_reviews(session_id, created_at desc)`,
  `create index if not exists idx_rule_quality_checks_review on rule_quality_checks(review_id)`,
  `create index if not exists idx_price_quotes_symbol_date on price_quotes(symbol, market, quote_date desc)`,
  `create index if not exists idx_rule_alert_events_user on rule_alert_events(user_id, created_at desc)`,
  `create index if not exists idx_portfolio_targets_user_portfolio on portfolio_targets(user_id, portfolio_id)`,
  `create index if not exists idx_drift_alert_events_portfolio_target on drift_alert_events(portfolio_id, target_type, target_key, quote_date desc)`,
  `create index if not exists idx_news_ticker_matches_symbol on news_ticker_matches(symbol, market)`,
  `create index if not exists idx_news_assessments_user_created on news_assessments(user_id, created_at desc)`,
  `create unique index if not exists idx_holistic_reviews_user_period on holistic_reviews(user_id, period)`,
  `create index if not exists idx_auth_sessions_user on auth_sessions(user_id)`,
  `create index if not exists idx_auth_sessions_expiry on auth_sessions(expires_at)`,
  `create index if not exists idx_financial_statements_ticker_period on financial_statements(ticker, market, fiscal_period desc)`,
  `create index if not exists idx_knowledge_articles_active on knowledge_articles(is_active, updated_at desc)`,
  `create index if not exists idx_api_access_tokens_user on api_access_tokens(user_id, created_at desc)`,
  `create index if not exists idx_api_tool_audit_logs_token on api_tool_audit_logs(token_id, created_at desc)`,
];

export function initializeSqliteSchema(db: Database.Database) {
  db.pragma("foreign_keys = on");
  db.pragma("journal_mode = WAL");

  // 旧フェーズでは price_quotes に ticker 列だけが存在し、後続の
  // symbol インデックスを作る前に列を追加しないと既存DBの起動に失敗する。
  if (hasTable(db, "price_quotes")) {
    ensureColumn(db, "price_quotes", "symbol", "text");
    ensureColumn(db, "price_quotes", "market", "text not null default 'JP'");
    ensureColumn(db, "price_quotes", "source", "text not null default 'mock'");
    if (hasColumn(db, "price_quotes", "ticker")) {
      db.prepare(
        `update price_quotes set symbol = ticker where symbol is null`,
      ).run();
    }
  }

  const migrate = db.transaction(() => {
    for (const statement of schemaStatements) {
      db.prepare(statement).run();
    }
  });

  migrate();
  ensureColumn(db, "app_users", "role", "text not null default 'user'");
  ensureColumn(db, "user_ui_preferences", "ai_provider", "text");
  ensureColumn(db, "user_ui_preferences", "ai_model", "text");
  ensureColumn(db, "rule_questions", "allow_unknown", "integer not null default 1");
  ensureColumn(db, "rule_questions", "unknown_default_json", "text");
  ensureColumn(db, "rule_questions", "breaker_source", "text");
  ensureColumn(db, "rule_alert_events", "resolution", "text");
  ensureColumn(db, "rule_alert_events", "resolved_at", "text");
  ensureColumn(db, "price_quotes", "symbol", "text");
  ensureColumn(db, "price_quotes", "market", "text not null default 'JP'");
  ensureColumn(db, "price_quotes", "source", "text not null default 'mock'");
  if (hasTable(db, "user_documents")) {
    ensureColumn(db, "user_documents", "document_kind", "text not null default 'note'");
    ensureColumn(db, "user_documents", "fiscal_period", "text");
    ensureColumn(db, "user_documents", "ticker", "text");
  }
  if (hasColumn(db, "price_quotes", "ticker")) {
    db.prepare(
      `update price_quotes set symbol = ticker where symbol is null`,
    ).run();
  }
  db.prepare(
    "create index if not exists idx_price_quotes_symbol_date on price_quotes(symbol, market, quote_date desc)",
  ).run();
}

function hasColumn(db: Database.Database, table: string, column: string) {
  return (db
    .prepare(`pragma table_info("${table.replaceAll('"', '""')}")`)
    .all() as Array<{ name: string }>).some(
    (candidate) => candidate.name === column,
  );
}

function hasTable(db: Database.Database, table: string) {
  return Boolean(
    db
      .prepare("select 1 from sqlite_master where type = 'table' and name = ?")
      .get(table),
  );
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
