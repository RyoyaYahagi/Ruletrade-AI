-- ============================================================
-- Rule State Transitions Audit Trail
-- ============================================================

create table rule_state_transitions (
  id uuid primary key default gen_random_uuid(),

  rule_id uuid not null references trading_rules(id) on delete cascade,

  from_status text not null check (
    from_status in ('draft', 'in_review', 'blocked', 'approved', 'rejected')
  ),
  to_status text not null check (
    to_status in ('draft', 'in_review', 'blocked', 'approved', 'rejected')
  ),

  actor_type text not null default 'user' check (
    actor_type in ('user', 'system', 'agent')
  ),
  actor_id uuid references app_users(id) on delete set null,
  actor_name text,

  reason text,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

-- Indexes
create index idx_rule_state_transitions_rule_id
on rule_state_transitions(rule_id, created_at desc);

create index idx_rule_state_transitions_actor_id
on rule_state_transitions(actor_id);

-- RLS
alter table rule_state_transitions enable row level security;

create policy "Users can CRUD their own rule state transitions"
on rule_state_transitions
for all
using (rule_id in (select id from trading_rules where user_id = auth.uid()));
