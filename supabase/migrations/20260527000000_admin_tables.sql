-- Admin Users table
create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references app_users(id) on delete cascade,
  role text not null check (role in ('owner', 'ops', 'support', 'viewer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Admin Audit Logs table
create table if not exists admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references admin_users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);

-- Admin Notes table
create table if not exists admin_notes (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references admin_users(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_admin_users_user_id on admin_users(user_id);
create index if not exists idx_admin_audit_logs_admin_created on admin_audit_logs(admin_user_id, created_at desc);
create index if not exists idx_admin_audit_logs_target on admin_audit_logs(target_type, target_id, created_at desc);
create index if not exists idx_admin_notes_target on admin_notes(target_type, target_id, created_at desc);

-- RLS: admin tables should only be accessible by admin users
-- For MVP, we rely on server-side auth checks rather than complex RLS policies.
-- Service role is used for admin queries.
alter table admin_users enable row level security;
alter table admin_audit_logs enable row level security;
alter table admin_notes enable row level security;
