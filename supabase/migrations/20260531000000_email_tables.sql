create table if not exists public.email_send_logs (
  id uuid primary key default gen_random_uuid(),
  to_address text not null,
  subject text not null,
  template_key text,
  provider text not null default 'mock',
  status text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'bounced', 'failed', 'suppressed')),
  error_message text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.email_send_logs is 'Audit log for transactional emails.';

 create trigger set_email_send_logs_updated_at
 before update on public.email_send_logs
 for each row execute function set_updated_at();

 create index idx_email_send_logs_to_status
 on public.email_send_logs(to_address, status);

 create index idx_email_send_logs_idempotency
 on public.email_send_logs(idempotency_key);

alter table public.email_send_logs enable row level security;
 create policy admin_only_email_logs on public.email_send_logs
 for all using (auth.jwt()->>'role' = 'admin');

create table if not exists public.email_suppressions (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  reason text not null check (reason in ('bounce', 'complaint', 'unsubscribe', 'manual')),
  source text,
  created_at timestamptz not null default now()
);

comment on table public.email_suppressions is 'Emails suppressed from further sends.';

alter table public.email_suppressions enable row level security;
 create policy admin_only_suppressions on public.email_suppressions
 for all using (auth.jwt()->>'role' = 'admin');

create table if not exists public.email_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade unique,
  transactional_enabled boolean not null default true,
  marketing_enabled boolean not null default true,
  beta_feedback_enabled boolean not null default true,
  digest_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.email_preferences is 'Per-user email preference settings.';

alter table public.email_preferences enable row level security;
 create policy own_email_preferences on public.email_preferences
 for all using (user_id = auth.uid());
