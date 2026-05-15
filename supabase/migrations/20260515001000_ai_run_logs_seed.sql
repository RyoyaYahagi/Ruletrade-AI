-- ============================================================
-- AI Run Logs Seed Data (Issue #51)
-- ============================================================

insert into model_pricing_configs (
  provider,
  model,
  input_cost_per_1m_tokens_usd,
  output_cost_per_1m_tokens_usd
)
values
  ('mock', 'mock-model', 0, 0);

-- TODO: Add real provider pricing before production launch
-- insert into model_pricing_configs (provider, model, input_cost_per_1m_tokens_usd, output_cost_per_1m_tokens_usd)
-- values
--   ('openai', 'gpt-4o', 2.50, 10.00),
--   ('openai', 'gpt-4o-mini', 0.15, 0.60),
--   ('gemini', 'gemini-2.5-pro-exp-03-25', 1.25, 10.00);
