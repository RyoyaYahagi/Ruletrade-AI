-- ============================================================
-- Error Handling / Rate Limit / Cost Limit MVP (Issue #53)
-- ============================================================

create table api_error_logs (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references app_users(id) on delete set null,

  request_id uuid not null,

  route text,
  method text,

  error_code text not null,
  error_message text not null,
  status_code int not null,

  retryable boolean not null default false,

  details jsonb,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create table rate_limit_counters (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,

  limit_key text not null,

  period_start timestamptz not null,
  period_end timestamptz not null,

  used_count int not null default 0 check (
    used_count >= 0
  ),

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, limit_key, period_start, period_end)
);

create trigger set_rate_limit_counters_updated_at
before update on rate_limit_counters
for each row
execute function set_updated_at();

create table cost_limit_counters (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,

  period_start timestamptz not null,
  period_end timestamptz not null,

  used_cost_usd numeric(10,6) not null default 0 check (
    used_cost_usd >= 0
  ),

  limit_cost_usd numeric(10,6) not null default 1 check (
    limit_cost_usd >= 0
  ),

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, period_start, period_end)
);

create trigger set_cost_limit_counters_updated_at
before update on cost_limit_counters
for each row
execute function set_updated_at();

-- ============================================================
-- Indexes
-- ============================================================

create index idx_api_error_logs_user_created
on api_error_logs(user_id, created_at desc);

create index idx_api_error_logs_request_id
on api_error_logs(request_id);

create index idx_api_error_logs_error_code_created
on api_error_logs(error_code, created_at desc);

create index idx_rate_limit_counters_user_key_period
on rate_limit_counters(user_id, limit_key, period_start, period_end);

create index idx_cost_limit_counters_user_period
on cost_limit_counters(user_id, period_start, period_end);

-- ============================================================
-- RLS
-- ============================================================

alter table api_error_logs enable row level security;
alter table rate_limit_counters enable row level security;
alter table cost_limit_counters enable row level security;

drop policy if exists "Users can read own api error logs" on api_error_logs;
drop policy if exists "Users can insert own api error logs" on api_error_logs;

create policy "Users can read own api error logs"
on api_error_logs
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own api error logs"
on api_error_logs
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read own rate limit counters" on rate_limit_counters;
drop policy if exists "Users can insert own rate limit counters" on rate_limit_counters;
drop policy if exists "Users can update own rate limit counters" on rate_limit_counters;

create policy "Users can read own rate limit counters"
on rate_limit_counters
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own rate limit counters"
on rate_limit_counters
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own rate limit counters"
on rate_limit_counters
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read own cost limit counters" on cost_limit_counters;
drop policy if exists "Users can insert own cost limit counters" on cost_limit_counters;
drop policy if exists "Users can update own cost limit counters" on cost_limit_counters;

create policy "Users can read own cost limit counters"
on cost_limit_counters
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own cost limit counters"
on cost_limit_counters
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own cost limit counters"
on cost_limit_counters
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
