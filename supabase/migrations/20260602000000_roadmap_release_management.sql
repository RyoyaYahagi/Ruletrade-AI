-- ============================================================
-- Roadmap / Milestone / Release Management MVP
-- Issue #81
-- ============================================================

create table if not exists product_roadmap_items (
  id uuid primary key default gen_random_uuid(),

  item_key text not null unique,

  title text not null,
  summary text not null,

  theme text not null,
  initiative text,

  public_status text not null default 'planned' check (
    public_status in (
      'exploring',
      'planned',
      'in_progress',
      'beta',
      'released',
      'paused',
      'cancelled'
    )
  ),

  internal_status text not null default 'backlog' check (
    internal_status in (
      'idea',
      'backlog',
      'ready',
      'in_progress',
      'blocked',
      'done',
      'released',
      'deferred',
      'cancelled'
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

  target_milestone_key text,
  target_release_key text,

  is_public boolean not null default false,
  sort_order int not null default 1000,

  created_by uuid references app_users(id) on delete set null,
  updated_by uuid references app_users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger if not exists set_product_roadmap_items_updated_at
before update on product_roadmap_items
for each row
execute function set_updated_at();

create table if not exists internal_milestones (
  id uuid primary key default gen_random_uuid(),

  milestone_key text not null unique,
  title text not null,
  description text,

  phase text not null check (
    phase in (
      'internal_alpha',
      'private_beta',
      'expanded_beta',
      'release_candidate',
      'public_launch',
      'open_beta',
      'post_launch'
    )
  ),

  status text not null default 'planned' check (
    status in (
      'planned',
      'active',
      'frozen',
      'completed',
      'cancelled'
    )
  ),

  target_date date,
  completed_at timestamptz,

  github_milestone_url text,
  github_project_url text,

  created_by uuid references app_users(id) on delete set null,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger if not exists set_internal_milestones_updated_at
before update on internal_milestones
for each row
execute function set_updated_at();

create table if not exists release_plans (
  id uuid primary key default gen_random_uuid(),

  release_key text not null unique,

  version text not null,
  title text not null,
  summary text,

  phase text not null check (
    phase in (
      'internal_alpha',
      'private_beta',
      'expanded_beta',
      'release_candidate',
      'public_launch',
      'hotfix'
    )
  ),

  status text not null default 'draft' check (
    status in (
      'draft',
      'planned',
      'code_freeze',
      'qa',
      'approved',
      'released',
      'rolled_back',
      'cancelled'
    )
  ),

  milestone_key text references internal_milestones(milestone_key) on delete set null,

  release_type text not null default 'minor' check (
    release_type in (
      'major',
      'minor',
      'patch',
      'hotfix',
      'prerelease'
    )
  ),

  planned_release_at timestamptz,
  released_at timestamptz,
  rolled_back_at timestamptz,

  git_tag text,
  git_commit_sha text,
  github_release_url text,
  vercel_deployment_url text,

  includes_db_migration boolean not null default false,
  includes_rls_change boolean not null default false,
  includes_env_change boolean not null default false,
  includes_feature_flag_change boolean not null default false,
  includes_ai_prompt_change boolean not null default false,
  includes_billing_change boolean not null default false,
  includes_privacy_change boolean not null default false,

  rollback_strategy text,
  release_notes text,

  created_by uuid references app_users(id) on delete set null,
  approved_by uuid references app_users(id) on delete set null,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger if not exists set_release_plans_updated_at
before update on release_plans
for each row
execute function set_updated_at();

create table if not exists release_plan_items (
  id uuid primary key default gen_random_uuid(),

  release_plan_id uuid not null references release_plans(id) on delete cascade,

  item_type text not null check (
    item_type in (
      'github_issue',
      'github_pr',
      'manual_task',
      'migration',
      'feature_flag',
      'doc',
      'test',
      'ops'
    )
  ),

  title text not null,
  description text,

  github_url text,
  local_issue_key text,

  status text not null default 'planned' check (
    status in (
      'planned',
      'in_progress',
      'done',
      'deferred',
      'removed',
      'blocked'
    )
  ),

  is_blocker boolean not null default false,

  risk_level text not null default 'low' check (
    risk_level in (
      'low',
      'medium',
      'high',
      'critical'
    )
  ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger if not exists set_release_plan_items_updated_at
before update on release_plan_items
for each row
execute function set_updated_at();

create table if not exists release_checklists (
  id uuid primary key default gen_random_uuid(),

  release_plan_id uuid not null references release_plans(id) on delete cascade,

  checklist_key text not null,
  title text not null,

  status text not null default 'open' check (
    status in (
      'open',
      'passed',
      'failed',
      'blocked',
      'skipped'
    )
  ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (release_plan_id, checklist_key)
);

create trigger if not exists set_release_checklists_updated_at
before update on release_checklists
for each row
execute function set_updated_at();

create table if not exists release_checklist_items (
  id uuid primary key default gen_random_uuid(),

  checklist_id uuid not null references release_checklists(id) on delete cascade,

  item_key text not null,
  title text not null,
  description text,

  category text not null check (
    category in (
      'product',
      'db',
      'rls',
      'ai_safety',
      'privacy',
      'security',
      'billing',
      'observability',
      'performance',
      'backup',
      'admin',
      'support',
      'email',
      'docs',
      'release'
    )
  ),

  status text not null default 'unchecked' check (
    status in (
      'unchecked',
      'passed',
      'failed',
      'blocked',
      'not_applicable'
    )
  ),

  checked_by uuid references app_users(id) on delete set null,
  checked_at timestamptz,

  evidence_url text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (checklist_id, item_key)
);

create trigger if not exists set_release_checklist_items_updated_at
before update on release_checklist_items
for each row
execute function set_updated_at();

create table if not exists release_approvals (
  id uuid primary key default gen_random_uuid(),

  release_plan_id uuid not null references release_plans(id) on delete cascade,

  approver_user_id uuid references app_users(id) on delete set null,

  approval_status text not null check (
    approval_status in (
      'pending',
      'approved',
      'rejected',
      'revoked'
    )
  ),

  approval_type text not null check (
    approval_type in (
      'owner',
      'technical',
      'security',
      'privacy',
      'billing',
      'release_manager'
    )
  ),

  comment text,

  decided_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger if not exists set_release_approvals_updated_at
before update on release_approvals
for each row
execute function set_updated_at();

create table if not exists release_changelog_entries (
  id uuid primary key default gen_random_uuid(),

  release_plan_id uuid references release_plans(id) on delete cascade,

  category text not null check (
    category in (
      'added',
      'changed',
      'deprecated',
      'removed',
      'fixed',
      'security'
    )
  ),

  audience text not null default 'internal' check (
    audience in (
      'internal',
      'public',
      'both'
    )
  ),

  title text not null,
  body text not null,

  is_breaking_change boolean not null default false,
  is_public_safe boolean not null default false,

  sort_order int not null default 1000,

  created_by uuid references app_users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger if not exists set_release_changelog_entries_updated_at
before update on release_changelog_entries
for each row
execute function set_updated_at();

create table if not exists release_risk_assessments (
  id uuid primary key default gen_random_uuid(),

  release_plan_id uuid not null references release_plans(id) on delete cascade,

  risk_area text not null check (
    risk_area in (
      'db',
      'rls',
      'ai_safety',
      'privacy',
      'security',
      'billing',
      'performance',
      'observability',
      'support',
      'rollback',
      'other'
    )
  ),

  risk_level text not null check (
    risk_level in (
      'low',
      'medium',
      'high',
      'critical'
    )
  ),

  description text not null,
  mitigation text,
  owner_user_id uuid references app_users(id) on delete set null,

  status text not null default 'open' check (
    status in (
      'open',
      'mitigated',
      'accepted',
      'blocked',
      'closed'
    )
  ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger if not exists set_release_risk_assessments_updated_at
before update on release_risk_assessments
for each row
execute function set_updated_at();

-- ============================================================
-- Indexes
-- ============================================================

create index if not exists idx_product_roadmap_items_public_sort
on product_roadmap_items(is_public, public_status, sort_order);

create index if not exists idx_product_roadmap_items_theme_priority
on product_roadmap_items(theme, priority, internal_status);

create index if not exists idx_internal_milestones_phase_status
on internal_milestones(phase, status);

create index if not exists idx_release_plans_status_phase
on release_plans(status, phase, planned_release_at desc);

create index if not exists idx_release_plans_version
on release_plans(version);

create index if not exists idx_release_plan_items_release_status
on release_plan_items(release_plan_id, status);

create index if not exists idx_release_plan_items_blocker
on release_plan_items(release_plan_id, is_blocker);

create index if not exists idx_release_checklists_release
on release_checklists(release_plan_id, status);

create index if not exists idx_release_checklist_items_checklist_status
on release_checklist_items(checklist_id, status);

create index if not exists idx_release_approvals_release_status
on release_approvals(release_plan_id, approval_status);

create index if not exists idx_release_changelog_entries_release_audience
on release_changelog_entries(release_plan_id, audience, category);

create index if not exists idx_release_risk_assessments_release_risk
on release_risk_assessments(release_plan_id, risk_level, status);

-- ============================================================
-- RLS
-- ============================================================

alter table product_roadmap_items enable row level security;
alter table internal_milestones enable row level security;
alter table release_plans enable row level security;
alter table release_plan_items enable row level security;
alter table release_checklists enable row level security;
alter table release_checklist_items enable row level security;
alter table release_approvals enable row level security;
alter table release_changelog_entries enable row level security;
alter table release_risk_assessments enable row level security;

-- Public roadmap items can be read publicly if explicitly marked public.
create policy if not exists "Anyone can read public roadmap items"
on product_roadmap_items
for select
to anon, authenticated
using (is_public = true);

-- Release management tables are Admin/server-side only in MVP.
-- Admin Console access must go through requireAdminPermission.
-- No direct anon read access to release tables.
