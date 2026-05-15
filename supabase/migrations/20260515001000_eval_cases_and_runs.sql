-- ============================================================
-- Basic Eval MVP (Issue #52)
-- ============================================================

create table eval_cases (
  id uuid primary key default gen_random_uuid(),

  case_key text not null unique,
  title text not null,
  description text,

  task_type text not null check (
    task_type in (
      'rule_review',
      'question_generation',
      'safety_check',
      'portfolio_review',
      'watchlist_review',
      'reflection_review',
      'document_rag_review'
    )
  ),

  input_json jsonb not null,
  expected_json jsonb not null,

  tags text[] not null default '{}',

  difficulty text not null default 'medium' check (
    difficulty in (
      'easy',
      'medium',
      'hard',
      'adversarial'
    )
  ),

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_eval_cases_updated_at
before update on eval_cases
for each row
execute function set_updated_at();

create table eval_runs (
  id uuid primary key default gen_random_uuid(),

  run_name text,

  task_type text not null,

  provider text not null,
  model text not null,
  prompt_version text not null,

  status text not null default 'running' check (
    status in (
      'running',
      'completed',
      'failed',
      'cancelled'
    )
  ),

  total_cases int not null default 0,
  passed_cases int not null default 0,
  failed_cases int not null default 0,

  precision numeric(8,4),
  recall numeric(8,4),
  f1 numeric(8,4),

  schema_valid_rate numeric(8,4),
  safety_pass_rate numeric(8,4),

  avg_latency_ms numeric(12,2),
  total_estimated_cost_usd numeric(10,6),

  metadata jsonb not null default '{}'::jsonb,

  started_at timestamptz not null default now(),
  completed_at timestamptz,

  created_at timestamptz not null default now()
);

create table eval_run_results (
  id uuid primary key default gen_random_uuid(),

  eval_run_id uuid not null references eval_runs(id) on delete cascade,
  eval_case_id uuid not null references eval_cases(id) on delete cascade,

  ai_run_log_id uuid references ai_run_logs(id) on delete set null,

  status text not null check (
    status in (
      'passed',
      'failed',
      'error'
    )
  ),

  actual_json jsonb,
  expected_json jsonb not null,

  matched_checks text[] not null default '{}',
  missing_checks text[] not null default '{}',
  extra_checks text[] not null default '{}',

  true_positive int not null default 0,
  false_positive int not null default 0,
  false_negative int not null default 0,

  precision numeric(8,4),
  recall numeric(8,4),
  f1 numeric(8,4),

  schema_valid boolean,
  safety_passed boolean,

  latency_ms int,
  estimated_cost_usd numeric(10,6),

  error_code text,
  error_message text,

  created_at timestamptz not null default now(),

  unique (eval_run_id, eval_case_id)
);

create index idx_eval_cases_task_active
on eval_cases(task_type, is_active);

create index idx_eval_cases_case_key
on eval_cases(case_key);

create index idx_eval_runs_task_created
on eval_runs(task_type, created_at desc);

create index idx_eval_runs_prompt_version
on eval_runs(prompt_version, created_at desc);

create index idx_eval_run_results_run_id
on eval_run_results(eval_run_id);

create index idx_eval_run_results_case_id
on eval_run_results(eval_case_id);

-- MVPではevalは開発者用機能。
-- 通常ユーザーに公開しない場合、RLSで直接読み書きさせない。
alter table eval_cases enable row level security;
alter table eval_runs enable row level security;
alter table eval_run_results enable row level security;

-- Activeなeval_casesはログインユーザーが読めてもよい。
-- ただし、管理UIを作るまではServer-sideから扱う方針でもよい。
drop policy if exists "Authenticated users can read active eval cases" on eval_cases;

create policy "Authenticated users can read active eval cases"
on eval_cases
for select
to authenticated
using (is_active = true);
