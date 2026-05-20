-- ============================================================
-- Closed Beta / Invite / Launch Readiness MVP
-- ============================================================

create table beta_cohorts (
  id uuid primary key default gen_random_uuid(),
  cohort_key text not null unique,
  display_name text not null,
  description text,
  phase text not null check (
    phase in (
      'internal_alpha',
      'private_beta',
      'expanded_beta',
      'release_candidate',
      'public'
    )
  ),
  is_active boolean not null default true,
  max_users int check (max_users is null or max_users >= 0),
  created_by uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_beta_cohorts_updated_at
before update on beta_cohorts
for each row
execute function set_updated_at();

create table beta_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  cohort_id uuid references beta_cohorts(id) on delete set null,
  invite_status text not null default 'pending' check (
    invite_status in ('pending', 'sent', 'accepted', 'expired', 'revoked', 'failed')
  ),
  invited_by uuid references app_users(id) on delete set null,
  invited_user_id uuid references app_users(id) on delete set null,
  sent_at timestamptz,
  accepted_at timestamptz,
  expires_at timestamptz,
  invite_reason text,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_beta_invites_updated_at
before update on beta_invites
for each row
execute function set_updated_at();

create table beta_invite_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  cohort_id uuid references beta_cohorts(id) on delete set null,
  max_uses int not null default 1 check (max_uses > 0),
  used_count int not null default 0 check (used_count >= 0),
  is_active boolean not null default true,
  expires_at timestamptz,
  created_by uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (used_count <= max_uses)
);

create trigger set_beta_invite_codes_updated_at
before update on beta_invite_codes
for each row
execute function set_updated_at();

create table beta_access_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  cohort_id uuid references beta_cohorts(id) on delete set null,
  access_status text not null default 'active' check (
    access_status in ('active', 'paused', 'revoked', 'graduated')
  ),
  granted_by uuid references app_users(id) on delete set null,
  granted_reason text,
  invite_id uuid references beta_invites(id) on delete set null,
  invite_code_id uuid references beta_invite_codes(id) on delete set null,
  accepted_terms_at timestamptz,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create trigger set_beta_access_grants_updated_at
before update on beta_access_grants
for each row
execute function set_updated_at();

create table beta_feature_flags (
  id uuid primary key default gen_random_uuid(),
  flag_key text not null unique,
  display_name text not null,
  description text,
  is_enabled_globally boolean not null default false,
  enabled_cohort_keys text[] not null default '{}',
  enabled_user_ids uuid[] not null default '{}',
  kill_switch_enabled boolean not null default false,
  rollout_notes text,
  created_by uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_beta_feature_flags_updated_at
before update on beta_feature_flags
for each row
execute function set_updated_at();

create table beta_user_feedback_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete set null,
  cohort_id uuid references beta_cohorts(id) on delete set null,
  session_key text not null,
  status text not null default 'opened' check (
    status in ('opened', 'completed', 'skipped', 'expired')
  ),
  prompt_key text not null,
  triggered_route text,
  triggered_event text,
  completed_at timestamptz,
  skipped_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_beta_user_feedback_sessions_updated_at
before update on beta_user_feedback_sessions
for each row
execute function set_updated_at();

create table launch_readiness_reviews (
  id uuid primary key default gen_random_uuid(),
  review_key text not null unique,
  phase text not null check (
    phase in (
      'internal_alpha',
      'private_beta',
      'expanded_beta',
      'release_candidate',
      'public_launch'
    )
  ),
  status text not null default 'draft' check (
    status in ('draft', 'in_review', 'go', 'no_go', 'blocked')
  ),
  reviewed_by uuid references app_users(id) on delete set null,
  reviewed_at timestamptz,
  summary text,
  risks jsonb not null default '[]'::jsonb,
  blockers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_launch_readiness_reviews_updated_at
before update on launch_readiness_reviews
for each row
execute function set_updated_at();

create table launch_checklist_items (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references launch_readiness_reviews(id) on delete cascade,
  category text not null check (
    category in (
      'product', 'auth', 'db', 'rls', 'ai_safety', 'rag', 'privacy',
      'security', 'legal', 'billing', 'observability', 'performance',
      'backup', 'admin', 'docs', 'support'
    )
  ),
  item_key text not null,
  title text not null,
  description text,
  status text not null default 'unchecked' check (
    status in ('unchecked', 'passed', 'failed', 'not_applicable', 'blocked')
  ),
  checked_by uuid references app_users(id) on delete set null,
  checked_at timestamptz,
  evidence_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (review_id, item_key)
);

create trigger set_launch_checklist_items_updated_at
before update on launch_checklist_items
for each row
execute function set_updated_at();

create table launch_stop_switches (
  id uuid primary key default gen_random_uuid(),
  switch_key text not null unique,
  display_name text not null,
  description text,
  is_active boolean not null default false,
  severity text not null default 'warning' check (
    severity in ('info', 'warning', 'critical')
  ),
  activated_by uuid references app_users(id) on delete set null,
  deactivated_by uuid references app_users(id) on delete set null,
  activated_at timestamptz,
  deactivated_at timestamptz,
  activation_reason text,
  deactivation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_launch_stop_switches_updated_at
before update on launch_stop_switches
for each row
execute function set_updated_at();

-- Indexes

 create index idx_beta_cohorts_phase_active
 on beta_cohorts(phase, is_active);

 create index idx_beta_invites_email_status
 on beta_invites(email, invite_status);

 create index idx_beta_invites_cohort_created
 on beta_invites(cohort_id, created_at desc);

 create index idx_beta_invite_codes_active_expires
 on beta_invite_codes(is_active, expires_at);

 create index idx_beta_access_grants_user
 on beta_access_grants(user_id);

 create index idx_beta_access_grants_cohort_status
 on beta_access_grants(cohort_id, access_status);

 create index idx_beta_feature_flags_key
 on beta_feature_flags(flag_key);

 create index idx_beta_user_feedback_sessions_user_created
 on beta_user_feedback_sessions(user_id, created_at desc);

 create index idx_launch_readiness_reviews_phase_status
 on launch_readiness_reviews(phase, status);

 create index idx_launch_checklist_items_review_category
 on launch_checklist_items(review_id, category);

 create index idx_launch_stop_switches_active
 on launch_stop_switches(is_active);

-- RLS

alter table beta_cohorts enable row level security;
alter table beta_invites enable row level security;
alter table beta_invite_codes enable row level security;
alter table beta_access_grants enable row level security;
alter table beta_feature_flags enable row level security;
alter table beta_user_feedback_sessions enable row level security;
alter table launch_readiness_reviews enable row level security;
alter table launch_checklist_items enable row level security;
alter table launch_stop_switches enable row level security;

-- Admin-only policies (service role or explicit admin role)

 create policy admin_only_beta_cohorts on beta_cohorts
 for all using (auth.jwt()->>'role' = 'admin');

 create policy admin_only_beta_invites on beta_invites
 for all using (auth.jwt()->>'role' = 'admin');

 create policy admin_only_beta_invite_codes on beta_invite_codes
 for all using (auth.jwt()->>'role' = 'admin');

 create policy own_beta_access_grants on beta_access_grants
 for select using (user_id = auth.uid());

 create policy admin_beta_access_grants on beta_access_grants
 for all using (auth.jwt()->>'role' = 'admin');

 create policy admin_only_beta_feature_flags on beta_feature_flags
 for all using (auth.jwt()->>'role' = 'admin');

 create policy own_beta_feedback on beta_user_feedback_sessions
 for select using (user_id = auth.uid());

 create policy admin_beta_feedback on beta_user_feedback_sessions
 for all using (auth.jwt()->>'role' = 'admin');

 create policy admin_only_launch_reviews on launch_readiness_reviews
 for all using (auth.jwt()->>'role' = 'admin');

 create policy admin_only_launch_checklist on launch_checklist_items
 for all using (auth.jwt()->>'role' = 'admin');

 create policy admin_only_stop_switches on launch_stop_switches
 for all using (auth.jwt()->>'role' = 'admin');

-- Seed data

 insert into beta_cohorts (cohort_key, display_name, phase, description, max_users)
 values
   ('internal_alpha', 'Internal Alpha', 'internal_alpha', 'Owner/Admin/Developer only', 10),
   ('private_beta_01', 'Private Beta 01', 'private_beta', 'First closed beta cohort', 30),
   ('expanded_beta_01', 'Expanded Beta 01', 'expanded_beta', 'Extended beta with documents/watchlist', 50)
 on conflict (cohort_key) do nothing;

 insert into beta_feature_flags (flag_key, display_name, description, is_enabled_globally, enabled_cohort_keys, kill_switch_enabled)
 values
   ('ai_review', 'AI Review', 'Rule session AI review', false, '{"private_beta_01", "expanded_beta_01"}', false),
   ('rag_memory', 'RAG Memory', 'RAG context retrieval', false, '{"private_beta_01", "expanded_beta_01"}', false),
   ('document_upload', 'Document Upload', 'Document upload and extraction', false, '{"expanded_beta_01"}', false),
   ('watchlist', 'Watchlist', 'Watchlist management', false, '{"private_beta_01", "expanded_beta_01"}', false)
 on conflict (flag_key) do nothing;

 insert into launch_stop_switches (switch_key, display_name, description, is_active, severity)
 values
   ('disable_ai_review', 'Disable AI Review', 'Temporarily disable AI review endpoints', false, 'warning'),
   ('disable_rag_retrieval', 'Disable RAG Retrieval', 'Temporarily disable RAG retrieval', false, 'warning'),
   ('disable_document_upload', 'Disable Document Upload', 'Temporarily disable document upload', false, 'warning'),
   ('disable_billing_checkout', 'Disable Billing Checkout', 'Temporarily disable billing checkout', false, 'warning'),
   ('maintenance_mode', 'Maintenance Mode', 'Read-only maintenance mode', false, 'critical')
 on conflict (switch_key) do nothing;
