-- ============================================================
-- Architecture Decision Records / Engineering Governance / Technical Debt MVP
-- ============================================================

create table engineering_decisions (
  id uuid primary key default gen_random_uuid(),

  adr_number int not null unique check (adr_number > 0),
  decision_key text not null unique,

  title text not null,
  status text not null check (
    status in (
      'proposed',
      'accepted',
      'rejected',
      'deprecated',
      'superseded'
    )
  ),

  decision_area text not null check (
    decision_area in (
      'architecture',
      'db',
      'rls',
      'auth',
      'ai',
      'rag',
      'documents',
      'privacy',
      'security',
      'billing',
      'admin',
      'pwa',
      'observability',
      'release',
      'support',
      'email',
      'infra',
      'other'
    )
  ),

  file_path text not null,

  superseded_by_adr_number int,
  related_issue_key text,
  related_release_key text,

  decided_by uuid references app_users(id) on delete set null,
  decided_at timestamptz,

  summary text not null,
  consequences text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_engineering_decisions_updated_at
before update on engineering_decisions
for each row
execute function set_updated_at();

create table architecture_review_requests (
  id uuid primary key default gen_random_uuid(),

  request_key text not null unique,

  title text not null,
  description text not null,

  review_area text not null check (
    review_area in (
      'architecture',
      'db',
      'rls',
      'auth',
      'ai',
      'rag',
      'privacy',
      'security',
      'billing',
      'admin',
      'infra',
      'release',
      'other'
    )
  ),

  status text not null default 'requested' check (
    status in (
      'requested',
      'in_review',
      'approved',
      'rejected',
      'changes_requested',
      'cancelled'
    )
  ),

  risk_level text not null default 'medium' check (
    risk_level in (
      'low',
      'medium',
      'high',
      'critical'
    )
  ),

  requires_adr boolean not null default false,
  adr_number int,

  requested_by uuid references app_users(id) on delete set null,
  reviewed_by uuid references app_users(id) on delete set null,

  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,

  decision_summary text,
  rejection_reason text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_architecture_review_requests_updated_at
before update on architecture_review_requests
for each row
execute function set_updated_at();

create table technical_debt_items (
  id uuid primary key default gen_random_uuid(),

  debt_key text not null unique,

  title text not null,
  description text not null,

  debt_type text not null check (
    debt_type in (
      'code',
      'test',
      'docs',
      'architecture',
      'security',
      'privacy',
      'performance',
      'observability',
      'ux',
      'infra',
      'dependency',
      'data_model'
    )
  ),

  status text not null default 'open' check (
    status in (
      'open',
      'accepted',
      'in_progress',
      'paid_down',
      'wont_fix',
      'superseded'
    )
  ),

  priority text not null default 'p2' check (
    priority in (
      'p0',
      'p1',
      'p2',
      'p3',
      'p4'
    )
  ),

  severity text not null default 'medium' check (
    severity in (
      'low',
      'medium',
      'high',
      'critical'
    )
  ),

  area text not null,
  owner_user_id uuid references app_users(id) on delete set null,

  target_milestone_key text,
  target_release_key text,

  due_date date,
  accepted_until date,

  repayment_plan text,
  risk_if_not_fixed text,

  related_issue_key text,
  related_adr_number int,

  created_by uuid references app_users(id) on delete set null,
  resolved_by uuid references app_users(id) on delete set null,

  resolved_at timestamptz,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_technical_debt_items_updated_at
before update on technical_debt_items
for each row
execute function set_updated_at();

create table technical_debt_events (
  id uuid primary key default gen_random_uuid(),

  debt_item_id uuid not null references technical_debt_items(id) on delete cascade,

  actor_user_id uuid references app_users(id) on delete set null,

  event_type text not null check (
    event_type in (
      'created',
      'status_changed',
      'priority_changed',
      'severity_changed',
      'owner_changed',
      'due_date_changed',
      'repayment_plan_updated',
      'accepted',
      'paid_down',
      'wont_fix',
      'superseded'
    )
  ),

  old_value text,
  new_value text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create table engineering_exceptions (
  id uuid primary key default gen_random_uuid(),

  exception_key text not null unique,

  title text not null,
  description text not null,

  exception_type text not null check (
    exception_type in (
      'rls_exception',
      'service_role_usage',
      'logging_exception',
      'cache_exception',
      'dependency_exception',
      'test_coverage_exception',
      'security_exception',
      'privacy_exception',
      'performance_exception',
      'release_exception',
      'other'
    )
  ),

  status text not null default 'requested' check (
    status in (
      'requested',
      'approved',
      'rejected',
      'expired',
      'revoked',
      'resolved'
    )
  ),

  risk_level text not null default 'medium' check (
    risk_level in (
      'low',
      'medium',
      'high',
      'critical'
    )
  ),

  requested_by uuid references app_users(id) on delete set null,
  approved_by uuid references app_users(id) on delete set null,

  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  expires_at timestamptz,

  mitigation text,
  follow_up_debt_key text,
  related_issue_key text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_engineering_exceptions_updated_at
before update on engineering_exceptions
for each row
execute function set_updated_at();

create table engineering_risk_register (
  id uuid primary key default gen_random_uuid(),

  risk_key text not null unique,

  title text not null,
  description text not null,

  risk_area text not null check (
    risk_area in (
      'architecture',
      'db',
      'rls',
      'auth',
      'ai_safety',
      'rag',
      'privacy',
      'security',
      'billing',
      'performance',
      'observability',
      'infra',
      'release',
      'support',
      'other'
    )
  ),

  likelihood text not null check (
    likelihood in (
      'low',
      'medium',
      'high'
    )
  ),

  impact text not null check (
    impact in (
      'low',
      'medium',
      'high',
      'critical'
    )
  ),

  status text not null default 'open' check (
    status in (
      'open',
      'mitigating',
      'accepted',
      'closed'
    )
  ),

  mitigation_plan text,
  owner_user_id uuid references app_users(id) on delete set null,

  related_debt_key text,
  related_adr_number int,
  related_release_key text,

  created_by uuid references app_users(id) on delete set null,
  closed_by uuid references app_users(id) on delete set null,

  closed_at timestamptz,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_engineering_risk_register_updated_at
before update on engineering_risk_register
for each row
execute function set_updated_at();

create table dependency_review_items (
  id uuid primary key default gen_random_uuid(),

  dependency_name text not null,
  package_manager text not null check (
    package_manager in (
      'npm',
      'pnpm',
      'bun',
      'pip',
      'cargo',
      'go',
      'other'
    )
  ),

  requested_version text,
  resolved_version text,

  review_status text not null default 'pending' check (
    review_status in (
      'pending',
      'approved',
      'rejected',
      'needs_review',
      'removed'
    )
  ),

  usage_reason text not null,
  alternatives_considered text,

  license_name text,
  source_url text,

  security_score text,
  known_vulnerability_count int not null default 0 check (
    known_vulnerability_count >= 0
  ),

  is_runtime_dependency boolean not null default true,
  is_client_bundle_dependency boolean not null default false,

  requested_by uuid references app_users(id) on delete set null,
  reviewed_by uuid references app_users(id) on delete set null,

  reviewed_at timestamptz,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (dependency_name, package_manager)
);

create trigger set_dependency_review_items_updated_at
before update on dependency_review_items
for each row
execute function set_updated_at();

create table engineering_standards_checks (
  id uuid primary key default gen_random_uuid(),

  check_key text not null,

  check_type text not null check (
    check_type in (
      'adr',
      'pr_template',
      'codeowners',
      'issue_template',
      'dependency_review',
      'rls_review',
      'ai_safety_review',
      'privacy_review',
      'security_review',
      'release_gate',
      'manual'
    )
  ),

  status text not null check (
    status in (
      'passed',
      'failed',
      'warning',
      'not_checked'
    )
  ),

  target_type text,
  target_id text,

  findings jsonb not null default '[]'::jsonb,

  checked_by uuid references app_users(id) on delete set null,
  checked_at timestamptz not null default now(),

  created_at timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================

create index idx_engineering_decisions_status_area
on engineering_decisions(status, decision_area);

create index idx_engineering_decisions_adr_number
on engineering_decisions(adr_number);

create index idx_architecture_review_requests_status_risk
on architecture_review_requests(status, risk_level, created_at desc);

create index idx_technical_debt_items_status_priority
on technical_debt_items(status, priority, severity);

create index idx_technical_debt_items_area
on technical_debt_items(area, status);

create index idx_technical_debt_items_due_date
on technical_debt_items(due_date);

create index idx_technical_debt_events_item_created
on technical_debt_events(debt_item_id, created_at desc);

create index idx_engineering_exceptions_status_expires
on engineering_exceptions(status, expires_at);

create index idx_engineering_exceptions_type_risk
on engineering_exceptions(exception_type, risk_level);

create index idx_engineering_risk_register_status_area
on engineering_risk_register(status, risk_area);

create index idx_dependency_review_items_status
on dependency_review_items(review_status, package_manager);

create index idx_engineering_standards_checks_type_created
on engineering_standards_checks(check_type, created_at desc);

-- ============================================================
-- RLS
-- ============================================================

alter table engineering_decisions enable row level security;
alter table architecture_review_requests enable row level security;
alter table technical_debt_items enable row level security;
alter table technical_debt_events enable row level security;
alter table engineering_exceptions enable row level security;
alter table engineering_risk_register enable row level security;
alter table dependency_review_items enable row level security;
alter table engineering_standards_checks enable row level security;

-- MVPではEngineering Governance系テーブルはAdmin/server-side専用。
-- 通常ユーザーへ直接公開しない。
-- Public ADR / docsはMarkdownとして公開する場合のみ別途扱う。