-- ============================================================
-- Add ai_run_log_id to rule_reviews (Issue #51)
-- ============================================================

alter table public.rule_reviews
add column ai_run_log_id uuid references public.ai_run_logs(id) on delete set null;

create index idx_rule_reviews_ai_run_log
on public.rule_reviews(ai_run_log_id);
