-- ============================================================
-- Billing / Plans / Usage Limits MVP
-- ============================================================

create table billing_plans (
  id uuid primary key default gen_random_uuid(),

  stripe_price_id text unique,

  name text not null,
  slug text not null unique check (slug in ('free', 'starter', 'pro')),

  description text,

  monthly_ai_reviews int not null default 0,
  monthly_document_uploads int not null default 0,
  monthly_rag_indexings int not null default 0,
  monthly_embedding_requests int not null default 0,

  max_portfolios int not null default 1,
  max_watchlist_items int not null default 10,
  max_documents int not null default 5,
  max_storage_bytes bigint not null default 104857600, -- 100MB

  price_monthly int, -- in JPY
  price_yearly int,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_billing_plans_updated_at
before update on billing_plans
for each row
execute function set_updated_at();

create table billing_customers (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null unique references app_users(id) on delete cascade,

  stripe_customer_id text unique,

  default_plan_id uuid references billing_plans(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_billing_customers_updated_at
before update on billing_customers
for each row
execute function set_updated_at();

create table billing_subscriptions (
  id uuid primary key default gen_random_uuid(),

  customer_id uuid not null references billing_customers(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,

  stripe_subscription_id text unique,
  stripe_price_id text,

  plan_id uuid not null references billing_plans(id),

  status text not null default 'incomplete' check (
    status in ('active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'paused', 'trialing', 'unpaid')
  ),

  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_billing_subscriptions_updated_at
before update on billing_subscriptions
for each row
execute function set_updated_at();

create table usage_counters (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,

  counter_type text not null check (
    counter_type in (
      'ai_review',
      'document_upload',
      'rag_indexing',
      'embedding_request'
    )
  ),

  period_start timestamptz not null,
  period_end timestamptz not null,

  used_count int not null default 0,
  limit_count int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, counter_type, period_start)
);

create trigger set_usage_counters_updated_at
before update on usage_counters
for each row
execute function set_updated_at();

create table usage_events (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,

  event_type text not null check (
    event_type in (
      'ai_review',
      'document_upload',
      'rag_indexing',
      'embedding_request'
    )
  ),

  amount int not null default 1,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create table billing_webhook_events (
  id uuid primary key default gen_random_uuid(),

  stripe_event_id text unique not null,
  event_type text not null,

  payload jsonb not null,

  processed boolean not null default false,
  processed_at timestamptz,
  error_message text,

  created_at timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================

create index idx_billing_customers_user on billing_customers(user_id);
create index idx_billing_subscriptions_customer on billing_subscriptions(customer_id);
create index idx_billing_subscriptions_user on billing_subscriptions(user_id);
create index idx_billing_subscriptions_status on billing_subscriptions(status);
create index idx_usage_counters_user_period on usage_counters(user_id, counter_type, period_start);
create index idx_usage_events_user_created on usage_events(user_id, event_type, created_at desc);
create index idx_billing_webhook_events_processed on billing_webhook_events(processed, created_at);

-- ============================================================
-- RLS
-- ============================================================

alter table billing_plans enable row level security;
alter table billing_customers enable row level security;
alter table billing_subscriptions enable row level security;
alter table usage_counters enable row level security;
alter table usage_events enable row level security;
alter table billing_webhook_events enable row level security;

create policy "Authenticated can read billing plans"
on billing_plans
for select
to authenticated
using (true);

create policy "Users can read own billing customers"
on billing_customers
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read own subscriptions"
on billing_subscriptions
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read own usage counters"
on usage_counters
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read own usage events"
on usage_events
for select
to authenticated
using ((select auth.uid()) = user_id);

-- Webhook events are not readable by users
create policy "Webhook events not readable by users"
on billing_webhook_events
for select
to authenticated
using (false);

-- ============================================================
-- Seed data
-- ============================================================

insert into billing_plans (
  slug, name, description,
  monthly_ai_reviews, monthly_document_uploads, monthly_rag_indexings, monthly_embedding_requests,
  max_portfolios, max_watchlist_items, max_documents, max_storage_bytes,
  price_monthly, price_yearly,
  is_active
) values
  ('free', 'Free', '無料枠。個人利用に最適です。', 10, 3, 3, 20, 1, 5, 3, 104857600, null, null, true),
  ('starter', 'Starter', '入門プラン。AIレビューを増やしたい方向け。', 50, 10, 10, 100, 3, 20, 10, 1073741824, 980, 9800, true),
  ('pro', 'Pro', 'Proプラン。大量の資料とRAGが必要な方向け。', 200, 50, 50, 500, 10, 100, 50, 10737418240, 2980, 29800, true);
