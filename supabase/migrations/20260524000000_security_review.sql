-- ============================================================
-- Security Review Helpers
-- ============================================================

-- Check RLS status on public tables
select
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

-- Check RLS policies
select
  tablename,
  policyname,
  permissive,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- Check for tables without RLS (should be empty for app tables)
select tablename
from pg_tables
where schemaname = 'public'
  and rowsecurity = false
  and tablename not in (
    'pg_stat_statements',
    'spatial_ref_sys'
  )
order by tablename;
