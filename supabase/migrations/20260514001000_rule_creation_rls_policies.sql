-- ============================================================
-- Ruletrade-AI Rule Creation RLS Policies
-- ============================================================

-- Policy predicates use (select auth.uid()) so Postgres can evaluate the
-- current user once per statement instead of once per row.

-- ============================================================
-- Indexes for RLS predicates
-- ============================================================

create index if not exists idx_app_users_id
on public.app_users(id);

-- idx_investor_profiles_user_id は 20260514000000_initial_rule_creation_schema.sql で既に作成済み

create index if not exists idx_rule_design_sessions_user_id
on public.rule_design_sessions(user_id);

create index if not exists idx_rule_versions_user_id
on public.rule_versions(user_id);

create index if not exists idx_rule_questions_user_id
on public.rule_questions(user_id);

create index if not exists idx_rule_answers_user_id
on public.rule_answers(user_id);

create index if not exists idx_rule_reviews_user_id
on public.rule_reviews(user_id);

create index if not exists idx_rule_quality_checks_user_id
on public.rule_quality_checks(user_id);

-- ============================================================
-- Enable RLS
-- ============================================================

alter table public.app_users enable row level security;
alter table public.investor_profiles enable row level security;
alter table public.rule_design_sessions enable row level security;
alter table public.rule_versions enable row level security;
alter table public.rule_questions enable row level security;
alter table public.rule_answers enable row level security;
alter table public.rule_reviews enable row level security;
alter table public.rule_quality_checks enable row level security;

-- ============================================================
-- app_users
-- ============================================================

drop policy if exists "Users can read own app user" on public.app_users;
drop policy if exists "Users can insert own app user" on public.app_users;
drop policy if exists "Users can update own app user" on public.app_users;
drop policy if exists "Users can delete own app user" on public.app_users;

create policy "Users can read own app user"
on public.app_users
for select
to authenticated
using ((select auth.uid()) = id);

create policy "Users can insert own app user"
on public.app_users
for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "Users can update own app user"
on public.app_users
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- Account deletion is handled by a separate lifecycle flow.

-- ============================================================
-- investor_profiles
-- ============================================================

drop policy if exists "Users can read own investor profile" on public.investor_profiles;
drop policy if exists "Users can insert own investor profile" on public.investor_profiles;
drop policy if exists "Users can update own investor profile" on public.investor_profiles;
drop policy if exists "Users can delete own investor profile" on public.investor_profiles;

create policy "Users can read own investor profile"
on public.investor_profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own investor profile"
on public.investor_profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own investor profile"
on public.investor_profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Profile deletion is deferred to the account lifecycle flow.

-- ============================================================
-- rule_design_sessions
-- ============================================================

drop policy if exists "Users can read own rule sessions" on public.rule_design_sessions;
drop policy if exists "Users can insert own rule sessions" on public.rule_design_sessions;
drop policy if exists "Users can update own rule sessions" on public.rule_design_sessions;
drop policy if exists "Users can delete own rule sessions" on public.rule_design_sessions;

create policy "Users can read own rule sessions"
on public.rule_design_sessions
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own rule sessions"
on public.rule_design_sessions
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own rule sessions"
on public.rule_design_sessions
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own rule sessions"
on public.rule_design_sessions
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- ============================================================
-- rule_versions
-- ============================================================

drop policy if exists "Users can read own rule versions" on public.rule_versions;
drop policy if exists "Users can insert own rule versions" on public.rule_versions;
drop policy if exists "Users can update own rule versions" on public.rule_versions;
drop policy if exists "Users can delete own rule versions" on public.rule_versions;

create policy "Users can read own rule versions"
on public.rule_versions
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own rule versions"
on public.rule_versions
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own rule versions"
on public.rule_versions
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own rule versions"
on public.rule_versions
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- ============================================================
-- rule_questions
-- ============================================================

drop policy if exists "Users can read own rule questions" on public.rule_questions;
drop policy if exists "Users can insert own rule questions" on public.rule_questions;
drop policy if exists "Users can update own rule questions" on public.rule_questions;
drop policy if exists "Users can delete own rule questions" on public.rule_questions;

create policy "Users can read own rule questions"
on public.rule_questions
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own rule questions"
on public.rule_questions
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own rule questions"
on public.rule_questions
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own rule questions"
on public.rule_questions
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- ============================================================
-- rule_answers
-- ============================================================

drop policy if exists "Users can read own rule answers" on public.rule_answers;
drop policy if exists "Users can insert own rule answers" on public.rule_answers;
drop policy if exists "Users can update own rule answers" on public.rule_answers;
drop policy if exists "Users can delete own rule answers" on public.rule_answers;

create policy "Users can read own rule answers"
on public.rule_answers
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own rule answers"
on public.rule_answers
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own rule answers"
on public.rule_answers
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own rule answers"
on public.rule_answers
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- ============================================================
-- rule_reviews
-- ============================================================

drop policy if exists "Users can read own rule reviews" on public.rule_reviews;
drop policy if exists "Users can insert own rule reviews" on public.rule_reviews;
drop policy if exists "Users can update own rule reviews" on public.rule_reviews;
drop policy if exists "Users can delete own rule reviews" on public.rule_reviews;

create policy "Users can read own rule reviews"
on public.rule_reviews
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own rule reviews"
on public.rule_reviews
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own rule reviews"
on public.rule_reviews
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own rule reviews"
on public.rule_reviews
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- ============================================================
-- rule_quality_checks
-- ============================================================

drop policy if exists "Users can read own rule quality checks" on public.rule_quality_checks;
drop policy if exists "Users can insert own rule quality checks" on public.rule_quality_checks;
drop policy if exists "Users can update own rule quality checks" on public.rule_quality_checks;
drop policy if exists "Users can delete own rule quality checks" on public.rule_quality_checks;

create policy "Users can read own rule quality checks"
on public.rule_quality_checks
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own rule quality checks"
on public.rule_quality_checks
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own rule quality checks"
on public.rule_quality_checks
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own rule quality checks"
on public.rule_quality_checks
for delete
to authenticated
using ((select auth.uid()) = user_id);
