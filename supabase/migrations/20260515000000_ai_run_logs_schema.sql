-- ============================================================
-- AI Run Logs / Observability MVP (Issue #51)
-- ============================================================

create table ai_run_logs (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references app_users(id) on delete set null,

  request_id uuid,

  task_type text not null check (
    task_type in (
      'rule_review',
      'question_generation',
      'safety_check',
      'portfolio_review',
      'watchlist_review',
      'reflection_review',
      'document_rag_review',
      'embedding',
      'eval'
    )
  ),

  source_type text check (
    source_type in (
      'rule_session',
      'rule_review',
      'portfolio',
      'watchlist',
      'reflection',
      'document',
      'eval_case',
      'system'
    )
  ),

  source_id uuid,

  session_id uuid references rule_design_sessions(id) on delete set null,
  rule_review_id uuid references rule_reviews(id) on delete set null,

  provider text not null,
  model text not null,
  prompt_version text,

  status text not null default 'started' check (
    status in (
      'started',
      'succeeded',
      'failed',
      'cancelled',
      'timeout'
    )
  ),

  schema_valid boolean,
  safety_passed boolean,

  input_tokens int check (
    input_tokens is null
    or input_tokens >= 0
  ),

  output_tokens int check (
    output_tokens is null
    or output_tokens >= 0
  ),

  total_tokens int generated always as (
    coalesce(input_tokens, 0) + coalesce(output_tokens, 0)
  ) stored,

  estimated_cost_usd numeric(10,6) check (
    estimated_cost_usd is null
    or estimated_cost_usd >= 0
  ),

  latency_ms int check (
    latency_ms is null
    or latency_ms >= 0
  ),

  input_json jsonb,
  output_json jsonb,
  metadata jsonb not null default '{}'::jsonb,

  error_code text,
  error_message text,
  error_details jsonb,

  started_at timestamptz not null default now(),
  completed_at timestamptz,

  created_at timestamptz not null default now()
);

create table ai_run_log_events (
  id uuid primary key default gen_random_uuid(),

  ai_run_log_id uuid not null references ai_run_logs(id) on delete cascade,

  user_id uuid references app_users(id) on delete set null,

  event_type text not null,

  message text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create table model_pricing_configs (
  id uuid primary key default gen_random_uuid(),

  provider text not null,
  model text not null,

  input_cost_per_1m_tokens_usd numeric(12,6) not null default 0,
  output_cost_per_1m_tokens_usd numeric(12,6) not null default 0,

  currency text not null default 'USD',

  effective_from timestamptz not null default now(),
  effective_to timestamptz,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (provider, model, effective_from)
);

create trigger set_model_pricing_configs_updated_at
before update on model_pricing_configs
for each row
execute function set_updated_at();

-- ============================================================
-- Indexes
-- ============================================================

create index idx_ai_run_logs_user_created
on ai_run_logs(user_id, created_at desc);

create index idx_ai_run_logs_task_created
on ai_run_logs(task_type, created_at desc);

create index idx_ai_run_logs_provider_model
on ai_run_logs(provider, model, created_at desc);

create index idx_ai_run_logs_prompt_version
on ai_run_logs(prompt_version, created_at desc);

create index idx_ai_run_logs_session
on ai_run_logs(session_id, created_at desc);

create index idx_ai_run_logs_status
on ai_run_logs(status, created_at desc);

create index idx_ai_run_logs_safety
on ai_run_logs(safety_passed, created_at desc);

create index idx_ai_run_logs_schema_valid
on ai_run_logs(schema_valid, created_at desc);

create index idx_ai_run_log_events_run_id
on ai_run_log_events(ai_run_log_id, created_at);

create index idx_model_pricing_configs_provider_model
on model_pricing_configs(provider, model, is_active);

-- ============================================================
-- RLS
-- ============================================================

alter table ai_run_logs enable row level security;
alter table ai_run_log_events enable row level security;
alter table model_pricing_configs enable row level security;

drop policy if exists "Users can read own ai run logs" on ai_run_logs;
drop policy if exists "Users can insert own ai run logs" on ai_run_logs;
drop policy if exists "Users can update own ai run logs" on ai_run_logs;

create policy "Users can read own ai run logs"
on ai_run_logs
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own ai run logs"
on ai_run_logs
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own ai run logs"
on ai_run_logs
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read own ai run log events" on ai_run_log_events;
drop policy if exists "Users can insert own ai run log events" on ai_run_log_events;

create policy "Users can read own ai run log events"
on ai_run_log_events
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own ai run log events"
on ai_run_log_events
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Authenticated users can read active model pricing" on model_pricing_configs;

create policy "Authenticated users can read active model pricing"
on model_pricing_configs
for select
to authenticated
using (is_active = true);
