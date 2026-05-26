-- ============================================================
-- AI Run Logs / Observability MVP (Issue #51)
-- ============================================================

create table if not exists public.ai_run_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete cascade,
  request_id text,
  task_type text not null,
  source_type text,
  source_id uuid,
  session_id text,
  rule_review_id uuid,
  provider text not null,
  model text not null,
  prompt_version text,
  status text not null default 'started' check (status in ('started', 'completed', 'failed')),
  schema_valid boolean,
  safety_passed boolean,
  input_tokens integer,
  output_tokens integer,
  estimated_cost_usd real,
  latency_ms integer,
  input_json jsonb,
  output_json jsonb,
  error_code text,
  error_message text,
  error_details jsonb,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ai_run_logs is 'AI model invocation logs for observability.';

create trigger set_ai_run_logs_updated_at
before update on public.ai_run_logs
for each row execute function set_updated_at();

create index idx_ai_run_logs_user_started
on public.ai_run_logs(user_id, started_at desc);

create index idx_ai_run_logs_task_status
on public.ai_run_logs(task_type, status);

alter table public.ai_run_logs enable row level security;
create policy own_ai_run_logs on public.ai_run_logs
for select using (user_id = auth.uid());
create policy admin_ai_run_logs on public.ai_run_logs
for all using (auth.jwt()->>'role' = 'admin');
