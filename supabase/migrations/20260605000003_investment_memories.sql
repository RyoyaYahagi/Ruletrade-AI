-- ============================================================
-- User Investment Memories
-- ============================================================

create table user_investment_memories (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,

  risk_tolerance text check (
    risk_tolerance in ('conservative', 'moderate', 'aggressive')
  ),
  preferred_markets jsonb not null default '[]'::jsonb,
  time_horizons jsonb not null default '[]'::jsonb,
  rejected_patterns jsonb not null default '[]'::jsonb,
  standing_constraints jsonb not null default '[]'::jsonb,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_user_investment_memories_updated_at
before update on user_investment_memories
for each row
execute function set_updated_at();

-- Indexes
create index idx_user_investment_memories_user_id
on user_investment_memories(user_id);

-- RLS
alter table user_investment_memories enable row level security;

create policy "Users can CRUD their own investment memory"
on user_investment_memories
for all
using (user_id = auth.uid());
