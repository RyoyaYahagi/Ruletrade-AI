-- Seed: Model Pricing Configs for AI Observability
-- MVP seed data — update with actual pricing before production

insert into model_pricing_configs (
  provider,
  model,
  input_cost_per_1m_tokens_usd,
  output_cost_per_1m_tokens_usd
)
values
  -- Mock provider (no cost)
  ('mock', 'mock-model', 0, 0),

  -- OpenAI models (approximate pricing as of 2026-05)
  ('openai', 'gpt-4o', 2.50, 10.00),
  ('openai', 'gpt-4o-mini', 0.15, 0.60),
  ('openai', 'gpt-4-turbo', 10.00, 30.00),
  ('openai', 'gpt-3.5-turbo', 0.50, 1.50),

  -- Gemini models (approximate pricing as of 2026-05)
  ('gemini', 'gemini-2.5-pro-preview-05-06', 1.25, 5.00),
  ('gemini', 'gemini-2.5-flash-preview-05-06', 0.15, 0.60),
  ('gemini', 'gemini-1.5-pro', 1.25, 5.00),
  ('gemini', 'gemini-1.5-flash', 0.075, 0.30)

on conflict (provider, model, effective_from) do nothing;
