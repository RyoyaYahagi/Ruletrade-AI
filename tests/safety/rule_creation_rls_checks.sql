-- Rule Creation RLS manual checks.
--
-- Run these after applying migrations. The catalog checks can be run from the
-- Supabase SQL editor. Behavioral checks must be run through the app or a
-- Supabase client using anon/authenticated tokens because the SQL editor may
-- execute with elevated privileges.

select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'app_users',
    'investor_profiles',
    'rule_design_sessions',
    'rule_versions',
    'rule_questions',
    'rule_answers',
    'rule_reviews',
    'rule_quality_checks'
  )
order by tablename;

select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'app_users',
    'investor_profiles',
    'rule_design_sessions',
    'rule_versions',
    'rule_questions',
    'rule_answers',
    'rule_reviews',
    'rule_quality_checks'
  )
order by tablename, policyname;

select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'idx_app_users_id',
    'idx_investor_profiles_user_id',
    'idx_rule_design_sessions_user_id',
    'idx_rule_versions_user_id',
    'idx_rule_questions_user_id',
    'idx_rule_answers_user_id',
    'idx_rule_reviews_user_id',
    'idx_rule_quality_checks_user_id'
  )
order by tablename, indexname;

-- Behavioral checklist:
--
-- 1. Create two Supabase Auth users, User A and User B.
-- 2. Log in as User A through the app or an authenticated Supabase client.
-- 3. Confirm User A can create and read rows where user_id = User A's id.
-- 4. Confirm User A cannot read rows where user_id = User B's id.
-- 5. Confirm User A cannot insert rows with User B's user_id.
-- 6. Confirm User A cannot update owned rows so user_id becomes User B's id.
-- 7. Confirm unauthenticated anon clients cannot read or write these tables.
