-- ============================================================
-- Accessibility / i18n / UX Polish MVP
-- ============================================================

create table user_ui_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  locale text not null default 'ja' check (locale in ('ja', 'en')),
  timezone text not null default 'Asia/Tokyo',
  color_scheme text not null default 'system' check (color_scheme in ('system', 'light', 'dark')),
  reduced_motion boolean not null default false,
  high_contrast boolean not null default false,
  larger_text boolean not null default false,
  compact_mode boolean not null default false,
  show_advanced_fields boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create trigger set_user_ui_preferences_updated_at
before update on user_ui_preferences
for each row
execute function set_updated_at();

create table accessibility_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete set null,
  route text not null,
  audit_type text not null check (
    audit_type in ('manual', 'automated', 'keyboard', 'screen_reader', 'contrast', 'form', 'mobile')
  ),
  status text not null check (status in ('passed', 'failed', 'needs_review')),
  findings jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create table i18n_translation_audit_logs (
  id uuid primary key default gen_random_uuid(),
  locale text not null check (locale in ('ja', 'en')),
  namespace text not null,
  missing_keys text[] not null default '{}',
  stale_keys text[] not null default '{}',
  status text not null check (status in ('passed', 'failed', 'needs_review')),
  created_at timestamptz not null default now()
);

-- Indexes
create index idx_user_ui_preferences_user on user_ui_preferences(user_id);
create index idx_accessibility_audit_logs_route_created on accessibility_audit_logs(route, created_at desc);
create index idx_accessibility_audit_logs_status_created on accessibility_audit_logs(status, created_at desc);
create index idx_i18n_translation_audit_logs_locale_namespace on i18n_translation_audit_logs(locale, namespace, created_at desc);

-- RLS
alter table user_ui_preferences enable row level security;
alter table accessibility_audit_logs enable row level security;
alter table i18n_translation_audit_logs enable row level security;

create policy "Users can read own ui preferences"
on user_ui_preferences for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own ui preferences"
on user_ui_preferences for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own ui preferences"
on user_ui_preferences for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
