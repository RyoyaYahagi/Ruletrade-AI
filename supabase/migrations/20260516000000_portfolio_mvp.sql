-- ============================================================
-- Portfolio MVP (Issue #55)
-- ============================================================

create table portfolios (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,

  name text not null default 'Main Portfolio' check (length(name) <= 100),

  base_currency text not null default 'JPY' check (
    base_currency in ('JPY', 'USD', 'EUR', 'GBP', 'OTHER')
  ),

  cash_amount numeric(18,2) not null default 0 check (
    cash_amount >= 0
  ),

  notes text check (length(notes) <= 4000),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_portfolios_updated_at
before update on portfolios
for each row
execute function set_updated_at();

create table portfolio_positions (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,
  portfolio_id uuid not null references portfolios(id) on delete cascade,

  ticker text not null check (length(ticker) <= 32),
  company_name text check (length(company_name) <= 200),

  market text not null default 'JP' check (
    market in ('JP', 'US', 'OTHER')
  ),
  currency text not null default 'JPY' check (
    currency in ('JPY', 'USD', 'EUR', 'GBP', 'OTHER')
  ),

  asset_type text not null default 'stock' check (
    asset_type in (
      'stock',
      'etf',
      'fund',
      'reit',
      'cash_like',
      'other'
    )
  ),

  sector text,
  theme text,

  quantity numeric(18,6) check (
    quantity is null
    or quantity >= 0
  ),

  average_cost numeric(18,4) check (
    average_cost is null
    or average_cost >= 0
  ),

  current_price numeric(18,4) check (
    current_price is null
    or current_price >= 0
  ),

  market_value numeric(18,2) not null default 0 check (
    market_value >= 0
  ),

  target_weight_percent numeric(5,2) check (
    target_weight_percent is null
    or (
      target_weight_percent >= 0
      and target_weight_percent <= 100
    )
  ),

  rule_session_id uuid references rule_design_sessions(id) on delete set null,

  position_status text not null default 'active' check (
    position_status in (
      'active',
      'watching',
      'exited',
      'archived'
    )
  ),

  memo text check (length(memo) <= 4000),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_portfolio_positions_updated_at
before update on portfolio_positions
for each row
execute function set_updated_at();

-- 同一ポートフォリオ内での銘柄重複防止
alter table portfolio_positions
add constraint unique_portfolio_ticker
unique (portfolio_id, ticker);

create table portfolio_reviews (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,
  portfolio_id uuid not null references portfolios(id) on delete cascade,

  provider text not null,
  model text not null,
  prompt_version text not null,

  review_json jsonb not null,

  summary text check (length(summary) <= 4000),

  risk_score int check (
    risk_score is null
    or (
      risk_score >= 0
      and risk_score <= 100
    )
  ),

  diversification_score int check (
    diversification_score is null
    or (
      diversification_score >= 0
      and diversification_score <= 100
    )
  ),

  rule_coverage_score int check (
    rule_coverage_score is null
    or (
      rule_coverage_score >= 0
      and rule_coverage_score <= 100
    )
  ),

  needs_more_info boolean not null default true,

  safety_passed boolean not null default true,
  schema_valid boolean not null default true,

  input_tokens int check (
    input_tokens is null
    or input_tokens >= 0
  ),

  output_tokens int check (
    output_tokens is null
    or output_tokens >= 0
  ),

  estimated_cost_usd numeric(10,6) check (
    estimated_cost_usd is null
    or estimated_cost_usd >= 0
  ),

  latency_ms int check (
    latency_ms is null
    or latency_ms >= 0
  ),

  error_message text,

  created_at timestamptz not null default now()
);

create table portfolio_quality_checks (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,
  portfolio_id uuid not null references portfolios(id) on delete cascade,
  review_id uuid references portfolio_reviews(id) on delete cascade,

  check_key text not null check (length(check_key) <= 100),
  label text not null check (length(label) <= 200),

  status text not null check (
    status in (
      'pass',
      'warning',
      'fail'
    )
  ),

  severity text not null check (
    severity in (
      'low',
      'medium',
      'high'
    )
  ),

  reason text not null check (length(reason) <= 2000),

  related_tickers text[] not null default '{}',

  suggested_question text,

  created_at timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================

create index idx_portfolios_user_created
on portfolios(user_id, created_at desc);

create index idx_portfolio_positions_user_portfolio
on portfolio_positions(user_id, portfolio_id);

create index idx_portfolio_positions_user_ticker
on portfolio_positions(user_id, ticker);

create index idx_portfolio_positions_portfolio_value
on portfolio_positions(portfolio_id, market_value desc);

create index idx_portfolio_reviews_user_created
on portfolio_reviews(user_id, created_at desc);

create index idx_portfolio_reviews_portfolio_created
on portfolio_reviews(portfolio_id, created_at desc);

create index idx_portfolio_quality_checks_review
on portfolio_quality_checks(review_id);

create index idx_portfolio_quality_checks_portfolio_status
on portfolio_quality_checks(portfolio_id, status);

-- ============================================================
-- RLS
-- ============================================================

alter table portfolios enable row level security;
alter table portfolio_positions enable row level security;
alter table portfolio_reviews enable row level security;
alter table portfolio_quality_checks enable row level security;

drop policy if exists "Users can read own portfolios" on portfolios;
drop policy if exists "Users can insert own portfolios" on portfolios;
drop policy if exists "Users can update own portfolios" on portfolios;
drop policy if exists "Users can delete own portfolios" on portfolios;

create policy "Users can read own portfolios"
on portfolios
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own portfolios"
on portfolios
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own portfolios"
on portfolios
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own portfolios"
on portfolios
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own portfolio positions" on portfolio_positions;
drop policy if exists "Users can insert own portfolio positions" on portfolio_positions;
drop policy if exists "Users can update own portfolio positions" on portfolio_positions;
drop policy if exists "Users can delete own portfolio positions" on portfolio_positions;

create policy "Users can read own portfolio positions"
on portfolio_positions
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own portfolio positions"
on portfolio_positions
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own portfolio positions"
on portfolio_positions
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own portfolio positions"
on portfolio_positions
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own portfolio reviews" on portfolio_reviews;
drop policy if exists "Users can insert own portfolio reviews" on portfolio_reviews;
drop policy if exists "Users can update own portfolio reviews" on portfolio_reviews;
drop policy if exists "Users can delete own portfolio reviews" on portfolio_reviews;

create policy "Users can read own portfolio reviews"
on portfolio_reviews
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own portfolio reviews"
on portfolio_reviews
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own portfolio reviews"
on portfolio_reviews
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own portfolio reviews"
on portfolio_reviews
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own portfolio quality checks" on portfolio_quality_checks;
drop policy if exists "Users can insert own portfolio quality checks" on portfolio_quality_checks;
drop policy if exists "Users can update own portfolio quality checks" on portfolio_quality_checks;
drop policy if exists "Users can delete own portfolio quality checks" on portfolio_quality_checks;

create policy "Users can read own portfolio quality checks"
on portfolio_quality_checks
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own portfolio quality checks"
on portfolio_quality_checks
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own portfolio quality checks"
on portfolio_quality_checks
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own portfolio quality checks"
on portfolio_quality_checks
for delete
to authenticated
using ((select auth.uid()) = user_id);
