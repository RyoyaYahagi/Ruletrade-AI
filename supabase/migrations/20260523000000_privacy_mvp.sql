-- ============================================================
-- Privacy / Data Deletion MVP
-- ============================================================

create table privacy_settings (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,

  ai_memory_enabled boolean not null default true,
  ai_logging_enabled boolean not null default true,
  ai_payload_logging_enabled boolean not null default false,

  allow_rag_indexing boolean not null default true,
  allow_document_indexing boolean not null default true,

  data_retention_days int check (
    data_retention_days is null
    or data_retention_days >= 0
  ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id)
);

create trigger set_privacy_settings_updated_at
before update on privacy_settings
for each row
execute function set_updated_at();

create table data_export_requests (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,

  status text not null default 'pending' check (
    status in (
      'pending',
      'processing',
      'completed',
      'failed',
      'cancelled'
    )
  ),

  export_format text not null default 'json' check (
    export_format in (
      'json',
      'csv'
    )
  ),

  include_ai_logs boolean not null default true,
  include_documents_metadata boolean not null default true,
  include_extracted_text boolean not null default false,
  include_rag_chunks boolean not null default false,

  storage_bucket text,
  storage_path text,

  error_message text,

  requested_at timestamptz not null default now(),
  completed_at timestamptz,

  created_at timestamptz not null default now()
);

create table data_deletion_requests (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references app_users(id) on delete set null,

  deletion_type text not null check (
    deletion_type in (
      'rag_memory',
      'document',
      'app_data',
      'account'
    )
  ),

  status text not null default 'pending' check (
    status in (
      'pending',
      'processing',
      'completed',
      'failed',
      'cancelled'
    )
  ),

  target_type text,
  target_id uuid,

  requested_by_user_id uuid references app_users(id) on delete set null,

  reason text,

  metadata jsonb not null default '{}'::jsonb,

  error_message text,

  requested_at timestamptz not null default now(),
  processing_started_at timestamptz,
  completed_at timestamptz,

  created_at timestamptz not null default now()
);

create table privacy_audit_logs (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references app_users(id) on delete set null,

  actor_user_id uuid references app_users(id) on delete set null,

  action text not null check (
    action in (
      'privacy_settings_updated',
      'data_export_requested',
      'data_export_completed',
      'data_deletion_requested',
      'rag_memory_deleted',
      'document_deleted',
      'app_data_deleted',
      'account_deleted',
      'deletion_failed',
      'export_failed'
    )
  ),

  target_type text,
  target_id uuid,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================

create index idx_privacy_settings_user
on privacy_settings(user_id);

create index idx_data_export_requests_user_created
on data_export_requests(user_id, created_at desc);

create index idx_data_export_requests_status
on data_export_requests(status, created_at);

create index idx_data_deletion_requests_user_created
on data_deletion_requests(user_id, created_at desc);

create index idx_data_deletion_requests_status
on data_deletion_requests(status, created_at);

create index idx_data_deletion_requests_target
on data_deletion_requests(target_type, target_id);

create index idx_privacy_audit_logs_user_created
on privacy_audit_logs(user_id, created_at desc);

create index idx_privacy_audit_logs_action_created
on privacy_audit_logs(action, created_at desc);

-- ============================================================
-- RLS
-- ============================================================

alter table privacy_settings enable row level security;
alter table data_export_requests enable row level security;
alter table data_deletion_requests enable row level security;
alter table privacy_audit_logs enable row level security;

create policy "Users can read own privacy settings"
on privacy_settings
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own privacy settings"
on privacy_settings
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own privacy settings"
on privacy_settings
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can read own data export requests"
on data_export_requests
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own data export requests"
on data_export_requests
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can read own data deletion requests"
on data_deletion_requests
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own data deletion requests"
on data_deletion_requests
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can read own privacy audit logs"
on privacy_audit_logs
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own privacy audit logs"
on privacy_audit_logs
for insert
to authenticated
with check ((select auth.uid()) = actor_user_id);
