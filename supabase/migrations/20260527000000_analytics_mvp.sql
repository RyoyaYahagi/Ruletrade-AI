-- ============================================================
-- Analytics / Feedback / Feature Flags MVP
-- ============================================================

create table product_events (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,

  event_name text not null check (
    event_name in (
      'page_view',
      'rule_session_created',
      'rule_session_completed',
      'ai_review_requested',
      'ai_review_safety_blocked',
      'watchlist_item_created',
      'watchlist_to_rule_session',
      'document_uploaded',
      'document_extraction_failed',
      'document_indexed',
      'portfolio_created',
      'notification_clicked',
      'privacy_setting_changed',
      'billing_plan_viewed',
      'account_deletion_requested'
    )
  ),

  properties jsonb not null default '{}'::jsonb,
  session_id text,

  created_at timestamptz not null default now()
);

create table feature_flags (
  id uuid primary key default gen_random_uuid(),

  name text not null unique,
  description text,

  enabled boolean not null default false,
  rollout_percentage int not null default 0 check (rollout_percentage between 0 and 100),

  target_roles text[] not null default '{}',
  target_plans text[] not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_feature_flags_updated_at
before update on feature_flags
for each row
execute function set_updated_at();

create table feature_flag_assignments (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,
  flag_id uuid not null references feature_flags(id) on delete cascade,

  enabled boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, flag_id)
);

create trigger set_feature_flag_assignments_updated_at
before update on feature_flag_assignments
for each row
execute function set_updated_at();

create table feedback_items (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,

  feedback_type text not null check (
    feedback_type in ('bug', 'feature_request', 'usability', 'other')
  ),

  title text not null,
  body text not null,

  status text not null default 'open' check (
    status in ('open', 'in_review', 'planned', 'done', 'declined')
  ),

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_feedback_items_updated_at
before update on feedback_items
for each row
execute function set_updated_at();

create table feedback_votes (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,
  feedback_id uuid not null references feedback_items(id) on delete cascade,

  vote_type text not null check (vote_type in ('up', 'down')),

  created_at timestamptz not null default now(),

  unique (user_id, feedback_id)
);

-- ============================================================
-- Indexes
-- ============================================================

create index idx_product_events_user_created on product_events(user_id, created_at desc);
create index idx_product_events_name_created on product_events(event_name, created_at desc);
create index idx_feature_flags_name on feature_flags(name);
create index idx_feature_flag_assignments_user on feature_flag_assignments(user_id);
create index idx_feedback_items_user on feedback_items(user_id);
create index idx_feedback_votes_feedback on feedback_votes(feedback_id);

-- ============================================================
-- RLS
-- ============================================================

alter table product_events enable row level security;
alter table feature_flags enable row level security;
alter table feature_flag_assignments enable row level security;
alter table feedback_items enable row level security;
alter table feedback_votes enable row level security;

create policy "Users can read own product events"
on product_events
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own product events"
on product_events
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can read feature flags"
on feature_flags
for select
to authenticated
using (true);

create policy "Users can read own feature flag assignments"
on feature_flag_assignments
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read feedback items"
on feedback_items
for select
to authenticated
using (true);

create policy "Users can insert own feedback"
on feedback_items
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can vote on feedback"
on feedback_votes
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can read feedback votes"
on feedback_votes
for select
to authenticated
using (true);
