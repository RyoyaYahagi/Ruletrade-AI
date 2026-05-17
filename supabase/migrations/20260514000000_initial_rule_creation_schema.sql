-- ============================================================
-- Ruletrade-AI Initial Rule Creation Schema
-- ============================================================

-- UUID generation
create extension if not exists pgcrypto;

-- ============================================================
-- updated_at trigger
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- app_users
-- ============================================================

create table public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,

  email text,
  display_name text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_app_users_updated_at
before update on public.app_users
for each row
execute function public.set_updated_at();

-- ============================================================
-- investor_profiles
-- ============================================================

create table public.investor_profiles (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references public.app_users(id) on delete cascade,

  experience_level text not null default 'beginner' check (
    experience_level in (
      'beginner',
      'intermediate',
      'advanced'
    )
  ),

  investment_style text check (
    investment_style in (
      'long_term',
      'swing',
      'dividend',
      'growth',
      'value',
      'mixed',
      'undecided'
    )
  ),

  risk_tolerance text check (
    risk_tolerance in (
      'low',
      'medium',
      'high',
      'unknown'
    )
  ),

  cash_buffer_range text check (
    cash_buffer_range in (
      'under_100k',
      '100k_500k',
      '500k_1m',
      '1m_3m',
      'over_3m',
      'prefer_not_to_say'
    )
  ),

  max_position_percent numeric(5,2) check (
    max_position_percent is null
    or (
      max_position_percent >= 0
      and max_position_percent <= 100
    )
  ),

  max_loss_percent numeric(5,2) check (
    max_loss_percent is null
    or (
      max_loss_percent >= 0
      and max_loss_percent <= 100
    )
  ),

  preferred_question_style text not null default 'guided' check (
    preferred_question_style in (
      'guided',
      'concise',
      'detailed',
      'bulk_input'
    )
  ),

  profile_json jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id)
);

create trigger set_investor_profiles_updated_at
before update on public.investor_profiles
for each row
execute function public.set_updated_at();

-- ============================================================
-- rule_design_sessions
-- ============================================================

create table public.rule_design_sessions (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references public.app_users(id) on delete cascade,

  ticker text not null,
  company_name text,

  market text,
  currency text default 'JPY',

  status text not null default 'draft' check (
    status in (
      'draft',
      'in_progress',
      'needs_more_info',
      'quality_gate_passed',
      'paused',
      'finalized',
      'archived'
    )
  ),

  template_key text,

  rule_json jsonb not null default '{}'::jsonb,

  completion_score int check (
    completion_score is null
    or (
      completion_score >= 0
      and completion_score <= 100
    )
  ),

  quality_gate_status text check (
    quality_gate_status in (
      'not_reviewed',
      'needs_more_info',
      'passed',
      'failed'
    )
  ),

  question_count int not null default 0 check (
    question_count >= 0
  ),

  max_question_count int not null default 12 check (
    max_question_count >= 1
  ),

  last_reviewed_at timestamptz,
  finalized_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_rule_design_sessions_updated_at
before update on public.rule_design_sessions
for each row
execute function public.set_updated_at();

-- ============================================================
-- rule_versions
-- ============================================================

create table public.rule_versions (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references public.app_users(id) on delete cascade,

  session_id uuid not null references public.rule_design_sessions(id) on delete cascade,

  version_number int not null check (
    version_number >= 1
  ),

  rule_json jsonb not null,

  change_reason text,

  created_by text not null default 'user' check (
    created_by in (
      'user',
      'ai',
      'system'
    )
  ),

  created_at timestamptz not null default now(),

  unique (session_id, version_number)
);

-- ============================================================
-- rule_questions
-- ============================================================

create table public.rule_questions (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references public.app_users(id) on delete cascade,

  session_id uuid not null references public.rule_design_sessions(id) on delete cascade,

  question_key text not null,

  question_text text not null,

  question_type text not null check (
    question_type in (
      'single_choice',
      'multiple_choice',
      'free_text',
      'number',
      'price_range',
      'date',
      'yes_no'
    )
  ),

  options jsonb,

  help_text text,

  priority int not null default 1 check (
    priority >= 1
    and priority <= 5
  ),

  is_required boolean not null default true,

  maps_to_rule_field text,

  source text not null default 'ai' check (
    source in (
      'template',
      'ai',
      'system'
    )
  ),

  status text not null default 'pending' check (
    status in (
      'pending',
      'answered',
      'skipped',
      'dismissed'
    )
  ),

  display_order int not null default 0,

  created_at timestamptz not null default now(),
  answered_at timestamptz
);

-- ============================================================
-- rule_answers
-- ============================================================

create table public.rule_answers (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references public.app_users(id) on delete cascade,

  session_id uuid not null references public.rule_design_sessions(id) on delete cascade,

  question_id uuid references public.rule_questions(id) on delete set null,

  question_key text not null,

  answer_text text,

  answer_json jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

-- ============================================================
-- rule_reviews
-- ============================================================

create table public.rule_reviews (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references public.app_users(id) on delete cascade,

  session_id uuid not null references public.rule_design_sessions(id) on delete cascade,

  rule_version_id uuid references public.rule_versions(id) on delete set null,

  provider text not null,
  model text not null,
  prompt_version text not null,

  review_json jsonb not null,

  summary text,

  completion_score int check (
    completion_score is null
    or (
      completion_score >= 0
      and completion_score <= 100
    )
  ),

  needs_more_info boolean not null default true,
  can_finalize boolean not null default false,

  safety_passed boolean not null default true,
  schema_valid boolean not null default true,

  input_tokens int check (
    input_tokens is null
    or input_tokens >= 0
  ),

  output_tokens int check (
    output_tokens is null
    or output_tokens >= 0
  ),

  estimated_cost_usd numeric(10,6) check (
    estimated_cost_usd is null
    or estimated_cost_usd >= 0
  ),

  latency_ms int check (
    latency_ms is null
    or latency_ms >= 0
  ),

  error_message text,

  created_at timestamptz not null default now()
);

-- ============================================================
-- rule_quality_checks
-- ============================================================

create table public.rule_quality_checks (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references public.app_users(id) on delete cascade,

  session_id uuid not null references public.rule_design_sessions(id) on delete cascade,

  review_id uuid references public.rule_reviews(id) on delete cascade,

  check_key text not null,

  label text not null,

  status text not null check (
    status in (
      'pass',
      'warning',
      'fail'
    )
  ),

  severity text not null check (
    severity in (
      'low',
      'medium',
      'high'
    )
  ),

  reason text not null,

  suggested_question text,

  created_at timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================

create index idx_investor_profiles_user_id
on public.investor_profiles(user_id);

create index idx_rule_design_sessions_user_created
on public.rule_design_sessions(user_id, created_at desc);

create index idx_rule_design_sessions_user_status
on public.rule_design_sessions(user_id, status);

create index idx_rule_design_sessions_user_ticker
on public.rule_design_sessions(user_id, ticker);

create index idx_rule_design_sessions_rule_json_gin
on public.rule_design_sessions using gin (rule_json);

create index idx_rule_versions_session_version
on public.rule_versions(session_id, version_number desc);

create index idx_rule_versions_user_created
on public.rule_versions(user_id, created_at desc);

create index idx_rule_questions_session_order
on public.rule_questions(session_id, display_order, created_at);

create index idx_rule_questions_session_status
on public.rule_questions(session_id, status);

create index idx_rule_answers_session_created
on public.rule_answers(session_id, created_at);

create index idx_rule_answers_question_id
on public.rule_answers(question_id);

create index idx_rule_reviews_session_created
on public.rule_reviews(session_id, created_at desc);

create index idx_rule_reviews_user_created
on public.rule_reviews(user_id, created_at desc);

create index idx_rule_quality_checks_review
on public.rule_quality_checks(review_id);

create index idx_rule_quality_checks_session_status
on public.rule_quality_checks(session_id, status);

-- ============================================================
-- Enable RLS
-- Policies will be created in the next RLS issue.
-- ============================================================

alter table public.app_users enable row level security;
alter table public.investor_profiles enable row level security;
alter table public.rule_design_sessions enable row level security;
alter table public.rule_versions enable row level security;
alter table public.rule_questions enable row level security;
alter table public.rule_answers enable row level security;
alter table public.rule_reviews enable row level security;
alter table public.rule_quality_checks enable row level security;
