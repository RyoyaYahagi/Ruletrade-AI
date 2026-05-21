-- ============================================================
-- Backtest Evaluations
-- ============================================================

create table backtest_evaluations (
  id uuid primary key default gen_random_uuid(),

  rule_id uuid not null references trading_rules(id) on delete cascade,

  status text not null default 'pending' check (
    status in ('pending', 'running', 'completed', 'failed')
  ),

  test_window_start date,
  test_window_end date,
  sample_size int,

  total_return_percent numeric(10,4),
  annualized_return_percent numeric(10,4),
  max_drawdown_percent numeric(10,4),
  sharpe_ratio numeric(10,4),
  win_rate_percent numeric(10,4),

  confidence_level numeric(3,2) check (confidence_level >= 0 and confidence_level <= 1),
  confidence_description text,

  known_failure_cases jsonb not null default '[]'::jsonb,
  limitations jsonb not null default '[]'::jsonb,

  evaluated_at timestamptz,
  evaluated_by uuid references app_users(id) on delete set null,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_backtest_evaluations_updated_at
before update on backtest_evaluations
for each row
execute function set_updated_at();

-- Indexes
create index idx_backtest_evaluations_rule_id
on backtest_evaluations(rule_id);

create index idx_backtest_evaluations_status
on backtest_evaluations(status);

-- RLS
alter table backtest_evaluations enable row level security;

create policy "Users can CRUD their own backtest evaluations"
on backtest_evaluations
for all
using (rule_id in (select id from trading_rules where user_id = auth.uid()));
