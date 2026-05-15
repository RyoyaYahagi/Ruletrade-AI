-- ============================================================
-- Atomic increment functions for rate/cost counters (Issue #53 fix)
-- ============================================================

create or replace function increment_rate_limit_counter(
  p_user_id uuid,
  p_limit_key text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_increment_by int default 1
)
returns int
language plpgsql
security definer
as $$
declare
  v_new_count int;
begin
  insert into rate_limit_counters (
    user_id, limit_key, period_start, period_end, used_count
  )
  values (p_user_id, p_limit_key, p_period_start, p_period_end, p_increment_by)
  on conflict (user_id, limit_key, period_start, period_end)
  do update set used_count = rate_limit_counters.used_count + p_increment_by
  returning used_count into v_new_count;

  return v_new_count;
end;
$$;

create or replace function increment_cost_limit_counter(
  p_user_id uuid,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_cost_usd numeric(10,6)
)
returns numeric(10,6)
language plpgsql
security definer
as $$
declare
  v_new_cost numeric(10,6);
begin
  insert into cost_limit_counters (
    user_id, period_start, period_end, used_cost_usd, limit_cost_usd
  )
  values (
    p_user_id, p_period_start, p_period_end, p_cost_usd, 10
  )
  on conflict (user_id, period_start, period_end)
  do update set used_cost_usd = cost_limit_counters.used_cost_usd + p_cost_usd
  returning used_cost_usd into v_new_cost;

  return v_new_cost;
end;
$$;
