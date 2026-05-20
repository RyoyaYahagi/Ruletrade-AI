-- System Events table

create table if not exists system_events (
  id uuid primary key default gen_random_uuid(),

  event_type text not null,
  severity text not null check (severity in ('info', 'warn', 'error', 'critical')),
  message text not null,

  request_id uuid,
  user_id uuid references app_users(id) on delete set null,
  route text,
  error_code text,
  duration_ms int check (duration_ms >= 0),

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

-- Monitoring Alerts table
create table if not exists monitoring_alerts (
  id uuid primary key default gen_random_uuid(),

  alert_name text not null,
  severity text not null check (severity in ('warn', 'error', 'critical')),
  message text not null,

  source text not null,
  condition text not null,

  triggered_at timestamptz not null default now(),
  resolved_at timestamptz,

  metadata jsonb not null default '{}'::jsonb
);

-- Health Check Logs table
create table if not exists health_check_logs (
  id uuid primary key default gen_random_uuid(),

  check_name text not null,
  status text not null check (status in ('pass', 'fail', 'warn')),
  latency_ms int not null check (latency_ms >= 0),
  message text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

-- Cron Run Logs table
create table if not exists cron_run_logs (
  id uuid primary key default gen_random_uuid(),

  cron_name text not null,
  status text not null check (status in ('started', 'completed', 'failed')),

  started_at timestamptz not null,
  finished_at timestamptz,

  error_message text,
  items_processed int,

  created_at timestamptz not null default now()
);

-- Webhook Processing Logs table
create table if not exists webhook_processing_logs (
  id uuid primary key default gen_random_uuid(),

  provider text not null,
  event_type text not null,
  external_event_id text,

  status text not null check (status in ('received', 'processing', 'completed', 'failed')),
  duration_ms int check (duration_ms >= 0),

  error_message text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_system_events_type_created
on system_events(event_type, created_at desc);

create index if not exists idx_system_events_severity_created
on system_events(severity, created_at desc);

create index if not exists idx_system_events_user_created
on system_events(user_id, created_at desc);

create index if not exists idx_monitoring_alerts_triggered
on monitoring_alerts(triggered_at desc);

create index if not exists idx_health_check_logs_name_created
on health_check_logs(check_name, created_at desc);

create index if not exists idx_cron_run_logs_name_started
on cron_run_logs(cron_name, started_at desc);

create index if not exists idx_webhook_processing_logs_provider_created
on webhook_processing_logs(provider, created_at desc);

-- RLS: disable for system tables since they are internal observability tables
-- In production, access should be restricted via service role or admin APIs only.
-- We keep RLS enabled but with no policies so only service role can access.
alter table system_events enable row level security;
alter table monitoring_alerts enable row level security;
alter table health_check_logs enable row level security;
alter table cron_run_logs enable row level security;
alter table webhook_processing_logs enable row level security;
