-- ============================================================
-- Structured Trading Rules
-- ============================================================

create table trading_rules (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,

  name text not null,
  description text,

  status text not null default 'draft' check (
    status in ('draft', 'in_review', 'blocked', 'approved', 'rejected')
  ),

  entry_conditions jsonb not null default '[]'::jsonb,
  exit_conditions jsonb not null default '[]'::jsonb,
  risk_limits jsonb not null default '{}'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  approval_requirements jsonb not null default '{}'::jsonb,

  natural_language_summary text,

  created_by uuid references app_users(id) on delete set null,
  approved_by uuid references app_users(id) on delete set null,
  approved_at timestamptz,

  version int not null default 1,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_trading_rules_updated_at
before update on trading_rules
for each row
execute function set_updated_at();

-- Indexes
create index idx_trading_rules_user_id
on trading_rules(user_id, created_at desc);

create index idx_trading_rules_status
on trading_rules(status, user_id);

-- RLS
alter table trading_rules enable row level security;

create policy "Users can CRUD their own trading rules"
on trading_rules
for all
using (user_id = auth.uid());
