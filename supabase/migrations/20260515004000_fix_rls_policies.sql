-- ============================================================
-- Fix RLS policies: restrict INSERT/UPDATE to server-side only (Issue #53 fix)
-- ============================================================

-- api_error_logs: remove INSERT policy (server-side only via service_role or RPC)
drop policy if exists "Users can insert own api error logs" on api_error_logs;

-- rate_limit_counters: remove INSERT/UPDATE policies (server-side only via RPC)
drop policy if exists "Users can insert own rate limit counters" on rate_limit_counters;
drop policy if exists "Users can update own rate limit counters" on rate_limit_counters;

-- cost_limit_counters: remove INSERT/UPDATE policies (server-side only via RPC)
drop policy if exists "Users can insert own cost limit counters" on cost_limit_counters;
drop policy if exists "Users can update own cost limit counters" on cost_limit_counters;
