-- ============================================================
-- Agent Workflows
-- ============================================================

create table agent_workflows (
  id uuid primary key default gen_random_uuid(),

  rule_id uuid references trading_rules(id) on delete set null,
  user_id uuid not null references app_users(id) on delete cascade,

  overall_status text not null default 'pending' check (
    overall_status in ('pending', 'running', 'completed', 'failed', 'blocked')
  ),

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_agent_workflows_updated_at
before update on agent_workflows
for each row
execute function set_updated_at();

-- Workflow steps
create table agent_workflow_steps (
  id uuid primary key default gen_random_uuid(),

  workflow_id uuid not null references agent_workflows(id) on delete cascade,

  agent_role text not null check (
    agent_role in ('orchestrator', 'generator', 'risk_reviewer', 'evaluator', 'explanation_writer')
  ),
  status text not null default 'pending' check (
    status in ('pending', 'running', 'completed', 'failed', 'blocked')
  ),

  input_data jsonb not null default '{}'::jsonb,
  output_data jsonb,
  error_message text,

  started_at timestamptz,
  completed_at timestamptz,

  model_used text,
  cost_estimate numeric(10,6),

  created_at timestamptz not null default now()
);

-- Indexes
create index idx_agent_workflows_rule_id
on agent_workflows(rule_id);

create index idx_agent_workflows_user_id
on agent_workflows(user_id, created_at desc);

create index idx_agent_workflow_steps_workflow_id
on agent_workflow_steps(workflow_id, created_at);

-- RLS
alter table agent_workflows enable row level security;
alter table agent_workflow_steps enable row level security;

create policy "Users can CRUD their own workflows"
on agent_workflows
for all
using (user_id = auth.uid());

create policy "Users can CRUD their own workflow steps"
on agent_workflow_steps
for all
using (
  workflow_id in (select id from agent_workflows where user_id = auth.uid())
);
