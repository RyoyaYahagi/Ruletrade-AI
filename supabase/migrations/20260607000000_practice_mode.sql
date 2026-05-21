-- ============================================================
-- Practice Mode / Education MVP
-- ============================================================

create table practice_sessions (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,

  name text not null default 'Practice Session',
  description text,

  virtual_balance numeric(19, 4) not null default 1000000,
  starting_balance numeric(19, 4) not null default 1000000,
  currency text not null default 'JPY',

  status text not null default 'active' check (
    status in ('active', 'paused', 'completed', 'abandoned')
  ),

  lesson_plan text,
  target_duration_days int,

  started_at timestamptz not null default now(),
  completed_at timestamptz,
  paused_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_practice_sessions_updated_at
before update on practice_sessions
for each row
execute function set_updated_at();

create table virtual_trades (
  id uuid primary key default gen_random_uuid(),

  practice_session_id uuid not null references practice_sessions(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,

  symbol text not null,
  symbol_name text,

  trade_type text not null check (
    trade_type in ('buy', 'sell')
  ),

  quantity numeric(19, 4) not null,
  entry_price numeric(19, 4) not null,
  exit_price numeric(19, 4),

  virtual_amount numeric(19, 4) not null,
  realized_pnl numeric(19, 4),

  trade_reason text,
  exit_reason text,

  rule_compliance_score int check (
    rule_compliance_score >= 0 and rule_compliance_score <= 100
  ),

  compliance_notes text,

  status text not null default 'open' check (
    status in ('open', 'closed', 'cancelled')
  ),

  opened_at timestamptz not null default now(),
  closed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_virtual_trades_updated_at
before update on virtual_trades
for each row
execute function set_updated_at();

create table practice_rules (
  id uuid primary key default gen_random_uuid(),

  practice_session_id uuid not null references practice_sessions(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,

  rule_name text not null,
  rule_type text not null check (
    rule_type in ('entry', 'exit', 'position_size', 'risk_management', 'review')
  ),

  condition_description text not null,
  max_position_ratio numeric(5, 4),
  max_loss_amount numeric(19, 4),

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_practice_rules_updated_at
before update on practice_rules
for each row
execute function set_updated_at();

create table lesson_progress (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,

  lesson_id text not null,
  lesson_title text not null,
  lesson_category text not null check (
    lesson_category in ('basics', 'rules', 'risk', 'review', 'portfolio')
  ),

  status text not null default 'not_started' check (
    status in ('not_started', 'in_progress', 'completed')
  ),

  completion_percent int not null default 0 check (
    completion_percent >= 0 and completion_percent <= 100
  ),

  started_at timestamptz,
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, lesson_id)
);

create trigger set_lesson_progress_updated_at
before update on lesson_progress
for each row
execute function set_updated_at();

-- ============================================================
-- Indexes
-- ============================================================

create index idx_practice_sessions_user_status
on practice_sessions(user_id, status);

create index idx_virtual_trades_session
on virtual_trades(practice_session_id);

create index idx_virtual_trades_user_symbol
on virtual_trades(user_id, symbol);

create index idx_practice_rules_session
on practice_rules(practice_session_id);

create index idx_lesson_progress_user
on lesson_progress(user_id, lesson_category);

-- ============================================================
-- RLS
-- ============================================================

alter table practice_sessions enable row level security;
alter table virtual_trades enable row level security;
alter table practice_rules enable row level security;
alter table lesson_progress enable row level security;

create policy "Users can CRUD own practice sessions"
on practice_sessions
for all
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users can CRUD own virtual trades"
on virtual_trades
for all
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users can CRUD own practice rules"
on practice_rules
for all
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users can CRUD own lesson progress"
on lesson_progress
for all
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
