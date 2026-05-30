-- ============================================================
-- Watchlist MVP (Issue #56)
-- ============================================================

create table watchlists (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,

  name text not null default 'Main Watchlist',

  base_currency text not null default 'JPY',

  description text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_watchlists_updated_at
before update on watchlists
for each row
execute function set_updated_at();

create table watchlist_items (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,
  watchlist_id uuid not null references watchlists(id) on delete cascade,

  ticker text not null,
  company_name text,

  market text,
  currency text not null default 'JPY',

  status text not null default 'watching' check (
    status in (
      'watching',
      'researching',
      'rule_designing',
      'ready_for_rule',
      'added_to_portfolio',
      'rejected',
      'archived'
    )
  ),

  priority text not null default 'medium' check (
    priority in (
      'low',
      'medium',
      'high'
    )
  ),

  interest_reason text,

  target_price_min numeric(18,4) check (
    target_price_min is null
    or target_price_min >= 0
  ),

  target_price_max numeric(18,4) check (
    target_price_max is null
    or target_price_max >= 0
  ),

  planned_tranches int check (
    planned_tranches is null
    or (
      planned_tranches >= 1
      and planned_tranches <= 20
    )
  ),

  target_multiple numeric(8,4) check (
    target_multiple is null
    or target_multiple > 0
  ),

  max_position_percent numeric(5,2) check (
    max_position_percent is null
    or (
      max_position_percent >= 0
      and max_position_percent <= 100
    )
  ),

  stop_loss_note text,

  take_profit_note text,

  earnings_note text,

  research_notes text,

  tags text[] not null default '{}',

  rule_session_id uuid references rule_design_sessions(id) on delete set null,

  last_reviewed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_watchlist_items_updated_at
before update on watchlist_items
for each row
execute function set_updated_at();

create table watchlist_reviews (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,
  watchlist_id uuid not null references watchlists(id) on delete cascade,
  item_id uuid references watchlist_items(id) on delete cascade,

  review_scope text not null check (
    review_scope in (
      'watchlist',
      'item'
    )
  ),

  provider text not null,
  model text not null,
  prompt_version text not null,

  review_json jsonb not null,

  summary text,

  readiness_score int check (
    readiness_score is null
    or (
      readiness_score >= 0
      and readiness_score <= 100
    )
  ),

  needs_more_info boolean not null default true,
  can_create_rule_session boolean not null default false,

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

create table watchlist_quality_checks (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,
  watchlist_id uuid not null references watchlists(id) on delete cascade,
  item_id uuid references watchlist_items(id) on delete cascade,
  review_id uuid references watchlist_reviews(id) on delete cascade,

  check_key text not null,
  label text not null,

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

  reason text not null,

  related_tickers text[] not null default '{}',

  suggested_question text,

  created_at timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================

create index idx_watchlists_user_created
on watchlists(user_id, created_at desc);

create index idx_watchlist_items_user_watchlist
on watchlist_items(user_id, watchlist_id);

create index idx_watchlist_items_user_ticker
on watchlist_items(user_id, ticker);

create index idx_watchlist_items_user_status_priority
on watchlist_items(user_id, status, priority);

create index idx_watchlist_items_rule_session
on watchlist_items(rule_session_id);

create index idx_watchlist_reviews_user_created
on watchlist_reviews(user_id, created_at desc);

create index idx_watchlist_reviews_watchlist_created
on watchlist_reviews(watchlist_id, created_at desc);

create index idx_watchlist_reviews_item_created
on watchlist_reviews(item_id, created_at desc);

create index idx_watchlist_quality_checks_review
on watchlist_quality_checks(review_id);

create index idx_watchlist_quality_checks_item_status
on watchlist_quality_checks(item_id, status);

-- ============================================================
-- RLS
-- ============================================================

alter table watchlists enable row level security;
alter table watchlist_items enable row level security;
alter table watchlist_reviews enable row level security;
alter table watchlist_quality_checks enable row level security;

drop policy if exists "Users can read own watchlists" on watchlists;
drop policy if exists "Users can insert own watchlists" on watchlists;
drop policy if exists "Users can update own watchlists" on watchlists;
drop policy if exists "Users can delete own watchlists" on watchlists;

create policy "Users can read own watchlists"
on watchlists
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own watchlists"
on watchlists
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own watchlists"
on watchlists
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own watchlists"
on watchlists
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own watchlist items" on watchlist_items;
drop policy if exists "Users can insert own watchlist items" on watchlist_items;
drop policy if exists "Users can update own watchlist items" on watchlist_items;
drop policy if exists "Users can delete own watchlist items" on watchlist_items;

create policy "Users can read own watchlist items"
on watchlist_items
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own watchlist items"
on watchlist_items
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own watchlist items"
on watchlist_items
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own watchlist items"
on watchlist_items
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own watchlist reviews" on watchlist_reviews;
drop policy if exists "Users can insert own watchlist reviews" on watchlist_reviews;

create policy "Users can read own watchlist reviews"
on watchlist_reviews
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own watchlist reviews"
on watchlist_reviews
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read own watchlist quality checks" on watchlist_quality_checks;
drop policy if exists "Users can insert own watchlist quality checks" on watchlist_quality_checks;

create policy "Users can read own watchlist quality checks"
on watchlist_quality_checks
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own watchlist quality checks"
on watchlist_quality_checks
for insert
to authenticated
with check ((select auth.uid()) = user_id);
