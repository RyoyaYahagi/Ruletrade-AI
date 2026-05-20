-- ============================================================
-- Production Environments / Deployment Operations MVP (Issue #85)
-- ============================================================

create table deployment_environments (
  id uuid primary key default gen_random_uuid(),

  environment_key text not null unique,
  display_name text not null,

  environment_type text not null check (
    environment_type in (
      'local',
      'preview',
      'staging',
      'production'
    )
  ),

  app_url text,
  vercel_project_id text,
  supabase_project_ref text,

  is_active boolean not null default true,
  is_production_like boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_deployment_environments_updated_at
before update on deployment_environments
for each row
execute function set_updated_at();

create table deployment_records (
  id uuid primary key default gen_random_uuid(),

  deployment_key text not null unique,

  environment_id uuid references deployment_environments(id) on delete set null,

  release_key text,
  version text,

  status text not null default 'created' check (
    status in (
      'created',
      'building',
      'deployed',
      'failed',
      'promoted',
      'rolled_back',
      'cancelled'
    )
  ),

  deployment_provider text not null default 'vercel' check (
    deployment_provider in (
      'vercel',
      'manual',
      'other'
    )
  ),

  deployment_url text,
  branch_name text,
  commit_sha text,
  pull_request_url text,

  includes_db_migration boolean not null default false,
  includes_env_change boolean not null default false,
  includes_feature_flag_change boolean not null default false,

  deployed_by uuid references app_users(id) on delete set null,
  deployed_at timestamptz,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_deployment_records_updated_at
before update on deployment_records
for each row
execute function set_updated_at();

create table deployment_checks (
  id uuid primary key default gen_random_uuid(),

  deployment_record_id uuid references deployment_records(id) on delete cascade,

  check_key text not null,
  title text not null,

  check_type text not null check (
    check_type in (
      'env',
      'build',
      'migration',
      'rls',
      'qa',
      'security',
      'privacy',
      'ai_safety',
      'smoke',
      'monitoring',
      'rollback',
      'manual'
    )
  ),

  status text not null default 'unchecked' check (
    status in (
      'unchecked',
      'passed',
      'failed',
      'blocked',
      'skipped'
    )
  ),

  evidence_url text,
  notes text,

  checked_by uuid references app_users(id) on delete set null,
  checked_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (deployment_record_id, check_key)
);

create trigger set_deployment_checks_updated_at
before update on deployment_checks
for each row
execute function set_updated_at();

create table environment_variable_inventory (
  id uuid primary key default gen_random_uuid(),

  variable_key text not null,

  environment_id uuid references deployment_environments(id) on delete cascade,

  classification text not null check (
    classification in (
      'public',
      'server_only',
      'secret',
      'provider_key',
      'webhook_secret',
      'cron_secret',
      'non_secret'
    )
  ),

  is_required boolean not null default true,
  is_configured boolean not null default false,

  should_be_next_public boolean not null default false,
  is_rotation_required boolean not null default false,

  last_verified_at timestamptz,
  verified_by uuid references app_users(id) on delete set null,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (variable_key, environment_id)
);

create trigger set_environment_variable_inventory_updated_at
before update on environment_variable_inventory
for each row
execute function set_updated_at();

create table deployment_migration_records (
  id uuid primary key default gen_random_uuid(),

  deployment_record_id uuid references deployment_records(id) on delete cascade,

  migration_name text not null,
  migration_version text,

  status text not null default 'planned' check (
    status in (
      'planned',
      'applied_preview',
      'applied_staging',
      'applied_production',
      'failed',
      'reverted',
      'forward_fixed'
    )
  ),

  is_destructive boolean not null default false,
  requires_backfill boolean not null default false,
  requires_downtime boolean not null default false,

  applied_at timestamptz,
  applied_by uuid references app_users(id) on delete set null,

  rollback_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_deployment_migration_records_updated_at
before update on deployment_migration_records
for each row
execute function set_updated_at();

create table rollback_records (
  id uuid primary key default gen_random_uuid(),

  deployment_record_id uuid references deployment_records(id) on delete set null,

  rollback_key text not null unique,

  rollback_type text not null check (
    rollback_type in (
      'vercel_rollback',
      'feature_flag',
      'stop_switch',
      'db_forward_fix',
      'manual'
    )
  ),

  status text not null default 'planned' check (
    status in (
      'planned',
      'in_progress',
      'completed',
      'failed',
      'cancelled'
    )
  ),

  reason text not null,
  impact_summary text,

  executed_by uuid references app_users(id) on delete set null,
  executed_at timestamptz,

  verification_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_rollback_records_updated_at
before update on rollback_records
for each row
execute function set_updated_at();

-- ============================================================
-- Indexes
-- ============================================================

create index idx_deployment_environments_type_active
on deployment_environments(environment_type, is_active);

create index idx_deployment_records_env_created
on deployment_records(environment_id, created_at desc);

create index idx_deployment_records_status_created
on deployment_records(status, created_at desc);

create index idx_deployment_records_release
on deployment_records(release_key, version);

create index idx_deployment_checks_record_status
on deployment_checks(deployment_record_id, status);

create index idx_environment_variable_inventory_env_required
on environment_variable_inventory(environment_id, is_required, is_configured);

create index idx_environment_variable_inventory_key
on environment_variable_inventory(variable_key);

create index idx_deployment_migration_records_deployment_status
on deployment_migration_records(deployment_record_id, status);

create index idx_rollback_records_status_created
on rollback_records(status, created_at desc);

-- ============================================================
-- RLS (Admin/server-side only for MVP)
-- ============================================================

alter table deployment_environments enable row level security;
alter table deployment_records enable row level security;
alter table deployment_checks enable row level security;
alter table environment_variable_inventory enable row level security;
alter table deployment_migration_records enable row level security;
alter table rollback_records enable row level security;

drop policy if exists "Users can read own deployment environments" on deployment_environments;
drop policy if exists "Users can read own deployment records" on deployment_records;
drop policy if exists "Users can read own deployment checks" on deployment_checks;
drop policy if exists "Users can read own env inventory" on environment_variable_inventory;
drop policy if exists "Users can read own migration records" on deployment_migration_records;
drop policy if exists "Users can read own rollback records" on rollback_records;

create policy "Users can read own deployment environments"
on deployment_environments
for select
to authenticated
using ((select auth.uid()) = id);

create policy "Users can read own deployment records"
on deployment_records
for select
to authenticated
using ((select auth.uid()) = deployed_by);

create policy "Users can read own deployment checks"
on deployment_checks
for select
to authenticated
using ((select auth.uid()) = checked_by);

create policy "Users can read own env inventory"
on environment_variable_inventory
for select
to authenticated
using ((select auth.uid()) = verified_by);

create policy "Users can read own migration records"
on deployment_migration_records
for select
to authenticated
using ((select auth.uid()) = applied_by);

create policy "Users can read own rollback records"
on rollback_records
for select
to authenticated
using ((select auth.uid()) = executed_by);

-- ============================================================
-- Seed: Environments
-- ============================================================

insert into deployment_environments (
  environment_key,
  display_name,
  environment_type,
  app_url,
  is_active,
  is_production_like
)
values
  ('local', 'Local Development', 'local', 'http://localhost:3000', true, false),
  ('preview', 'Vercel Preview', 'preview', null, true, false),
  ('staging', 'Staging', 'staging', 'https://staging.example.com', true, true),
  ('production', 'Production', 'production', 'https://app.example.com', true, true)
on conflict (environment_key) do nothing;
