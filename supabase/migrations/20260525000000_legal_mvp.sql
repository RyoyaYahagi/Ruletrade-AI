-- ============================================================
-- Legal / Compliance Boundary MVP
-- ============================================================

create table legal_acceptances (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,

  accepted_terms_at timestamptz,
  accepted_privacy_at timestamptz,
  accepted_disclaimer_at timestamptz,

  terms_version text,
  privacy_version text,
  disclaimer_version text,

  ip_address text,
  user_agent text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id)
);

create trigger set_legal_acceptances_updated_at
before update on legal_acceptances
for each row
execute function set_updated_at();

create table compliance_review_logs (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references app_users(id) on delete set null,

  review_type text not null check (
    review_type in (
      'ai_output',
      'user_input',
      'document_summary',
      'watchlist_review',
      'portfolio_review',
      'rule_review'
    )
  ),

  content_hash text not null,
  original_text text,
  reviewed_text text,

  passed boolean not null default false,
  risk_level text not null default 'low' check (
    risk_level in ('low', 'medium', 'high')
  ),

  violations jsonb not null default '[]'::jsonb,

  model text,
  latency_ms int,

  created_at timestamptz not null default now()
);

create table legal_notices (
  id uuid primary key default gen_random_uuid(),

  notice_type text not null check (
    notice_type in (
      'terms_of_service',
      'privacy_policy',
      'disclaimer',
      'cookie_policy',
      'withdrawal_notice'
    )
  ),

  version text not null,
  title text not null,
  body text not null,

  locale text not null default 'ja',

  effective_at timestamptz not null,
  deprecated_at timestamptz,

  required boolean not null default true,

  created_at timestamptz not null default now()
);

create table financial_safety_events (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references app_users(id) on delete set null,

  event_type text not null check (
    event_type in (
      'advice_attempt_blocked',
      'recommendation_attempt_blocked',
      'unsafe_output_detected',
      'prompt_injection_detected',
      'safety_check_failed',
      'compliance_gate_blocked'
    )
  ),

  source text not null check (
    source in ('ai', 'user', 'system', 'rag')
  ),

  original_content text,
  blocked_reason text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================

create index idx_legal_acceptances_user
on legal_acceptances(user_id);

create index idx_compliance_review_logs_user_created
on compliance_review_logs(user_id, created_at desc);

create index idx_compliance_review_logs_type_created
on compliance_review_logs(review_type, created_at desc);

create index idx_legal_notices_type_locale
on legal_notices(notice_type, locale, effective_at desc);

create index idx_financial_safety_events_user_created
on financial_safety_events(user_id, created_at desc);

create index idx_financial_safety_events_type_created
on financial_safety_events(event_type, created_at desc);

-- ============================================================
-- RLS
-- ============================================================

alter table legal_acceptances enable row level security;
alter table compliance_review_logs enable row level security;
alter table legal_notices enable row level security;
alter table financial_safety_events enable row level security;

create policy "Users can read own legal acceptances"
on legal_acceptances
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own legal acceptances"
on legal_acceptances
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own legal acceptances"
on legal_acceptances
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can read own compliance review logs"
on compliance_review_logs
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read legal notices"
on legal_notices
for select
to authenticated
using (true);

create policy "Users can read own financial safety events"
on financial_safety_events
for select
to authenticated
using ((select auth.uid()) = user_id);
