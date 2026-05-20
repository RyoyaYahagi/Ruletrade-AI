-- API Request Logs table for performance monitoring

create table if not exists api_request_logs (
  id uuid primary key default gen_random_uuid(),

  request_id uuid not null,
  user_id uuid references app_users(id) on delete set null,

  route text not null,
  method text not null,
  status_code int not null,

  duration_ms int not null check (duration_ms >= 0),

  error_code text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

-- Enable RLS
alter table api_request_logs enable row level security;

-- Indexes
create index if not exists idx_api_request_logs_route_created
on api_request_logs(route, created_at desc);

create index if not exists idx_api_request_logs_duration_created
on api_request_logs(duration_ms desc, created_at desc);

create index if not exists idx_api_request_logs_user_created
on api_request_logs(user_id, created_at desc);

-- RLS: users can read only their own logs
-- Admins can read all logs via service role
create policy "Users can read own api request logs"
on api_request_logs
for select
to authenticated
using ((select auth.uid()) = user_id);
