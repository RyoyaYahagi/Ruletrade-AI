-- ============================================================
-- Portfolio MVP: Add ai_run_log_id to portfolio_reviews
-- ============================================================

alter table portfolio_reviews
add column if not exists ai_run_log_id uuid references ai_run_logs(id) on delete set null;

create index if not exists idx_portfolio_reviews_ai_run_log
on portfolio_reviews(ai_run_log_id);
