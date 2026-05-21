-- ============================================================
-- Feature Flags
-- ============================================================

create table feature_flags (
  id uuid primary key default gen_random_uuid(),

  flag_key text not null unique,

  name text not null,
  description text,

  flag_type text not null check (
    flag_type in (
      'boolean',
      'variant',
      'percentage',
      'user_targeting',
      'environment'
    )
  ),

  default_value jsonb not null,

  is_enabled boolean not null default true,

  is_safety_critical boolean not null default false,

  owner text,
  expires_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_feature_flags_updated_at
before update on feature_flags
for each row
execute function set_updated_at();

create table feature_flag_rules (
  id uuid primary key default gen_random_uuid(),

  feature_flag_id uuid not null references feature_flags(id) on delete cascade,

  environment text not null check (
    environment in (
      'local',
      'development',
      'preview',
      'production'
    )
  ),

  rule_type text not null check (
    rule_type in (
      'default',
      'user_id',
      'email_domain',
      'percentage',
      'experience_level',
      'plan',
      'role'
    )
  ),

  conditions_json jsonb not null default '{}'::jsonb,

  value_json jsonb not null,

  priority int not null default 100,

  is_enabled boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_feature_flag_rules_updated_at
before update on feature_flag_rules
for each row
execute function set_updated_at();

create table feature_flag_evaluations (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references app_users(id) on delete set null,

  flag_key text not null,
  environment text not null,

  evaluated_value jsonb not null,

  rule_id uuid references feature_flag_rules(id) on delete set null,

  context_json jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create table feature_flag_change_logs (
  id uuid primary key default gen_random_uuid(),

  changed_by uuid references app_users(id) on delete set null,

  flag_key text not null,

  change_type text not null check (
    change_type in (
      'created',
      'updated',
      'enabled',
      'disabled',
      'rule_added',
      'rule_updated',
      'rule_removed'
    )
  ),

  before_json jsonb,
  after_json jsonb,

  reason text,

  created_at timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================

create index idx_feature_flags_key
on feature_flags(flag_key);

create index idx_feature_flag_rules_flag_env
on feature_flag_rules(feature_flag_id, environment);

create index idx_feature_flag_evaluations_user_flag
on feature_flag_evaluations(user_id, flag_key, created_at desc);

create index idx_feature_flag_change_logs_flag_created
on feature_flag_change_logs(flag_key, created_at desc);

-- ============================================================
-- RLS
-- ============================================================

alter table feature_flags enable row level security;
alter table feature_flag_rules enable row level security;
alter table feature_flag_evaluations enable row level security;
alter table feature_flag_change_logs enable row level security;

-- Only server-side reads; no direct client access to flag definitions
create policy "Server only read access to feature_flags"
on feature_flags
for select
using (false);

create policy "Server only read access to feature_flag_rules"
on feature_flag_rules
for select
using (false);

create policy "Users can read own evaluations"
on feature_flag_evaluations
for select
to authenticated
using (user_id = auth.uid());

create policy "Users can read own change logs"
on feature_flag_change_logs
for select
to authenticated
using (changed_by = auth.uid());
