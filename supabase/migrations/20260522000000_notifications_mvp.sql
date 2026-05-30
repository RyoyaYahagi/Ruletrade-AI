-- ============================================================
-- Notifications / Review Reminders MVP
-- ============================================================

create table notification_preferences (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,

  in_app_enabled boolean not null default true,
  web_push_enabled boolean not null default false,
  email_enabled boolean not null default false,

  rule_review_reminders_enabled boolean not null default true,
  pending_questions_enabled boolean not null default true,
  watchlist_reminders_enabled boolean not null default true,
  portfolio_reminders_enabled boolean not null default true,
  document_notifications_enabled boolean not null default true,

  quiet_hours_enabled boolean not null default false,
  quiet_hours_start time,
  quiet_hours_end time,

  timezone text not null default 'Asia/Tokyo',

  max_notifications_per_day int not null default 5 check (
    max_notifications_per_day >= 0
  ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id)
);

create trigger set_notification_preferences_updated_at
before update on notification_preferences
for each row
execute function set_updated_at();

create table notifications (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,

  notification_type text not null check (
    notification_type in (
      'rule_review_due',
      'rule_questions_pending',
      'rule_quality_gate_failed',
      'rule_finalizable',
      'watchlist_item_needs_rule',
      'watchlist_review_due',
      'portfolio_missing_rules',
      'portfolio_review_due',
      'document_extraction_completed',
      'document_summary_completed',
      'document_index_failed',
      'system_notice'
    )
  ),

  title text not null,
  body text not null,

  severity text not null default 'info' check (
    severity in (
      'info',
      'success',
      'warning',
      'error'
    )
  ),

  target_type text check (
    target_type in (
      'rule_session',
      'watchlist_item',
      'portfolio',
      'portfolio_position',
      'document',
      'system'
    )
  ),

  target_id uuid,

  action_url text,

  metadata jsonb not null default '{}'::jsonb,

  safety_checked boolean not null default true,
  safety_passed boolean not null default true,

  status text not null default 'queued' check (
    status in (
      'queued',
      'delivered',
      'read',
      'dismissed',
      'failed',
      'cancelled'
    )
  ),

  scheduled_for timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  dismissed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_notifications_updated_at
before update on notifications
for each row
execute function set_updated_at();

create table notification_delivery_logs (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,
  notification_id uuid references notifications(id) on delete cascade,

  channel text not null check (
    channel in (
      'in_app',
      'web_push',
      'email'
    )
  ),

  status text not null check (
    status in (
      'succeeded',
      'failed',
      'skipped'
    )
  ),

  provider text,

  provider_message_id text,

  error_code text,
  error_message text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create table notification_rules (
  id uuid primary key default gen_random_uuid(),

  rule_key text not null unique,

  notification_type text not null,

  title_template text not null,
  body_template text not null,

  is_enabled boolean not null default true,

  default_severity text not null default 'info' check (
    default_severity in (
      'info',
      'success',
      'warning',
      'error'
    )
  ),

  cooldown_hours int not null default 24 check (
    cooldown_hours >= 0
  ),

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_notification_rules_updated_at
before update on notification_rules
for each row
execute function set_updated_at();

-- ============================================================
-- Indexes
-- ============================================================

create index idx_notification_preferences_user
on notification_preferences(user_id);

create index idx_notifications_user_status_created
on notifications(user_id, status, created_at desc);

create index idx_notifications_user_type_created
on notifications(user_id, notification_type, created_at desc);

create index idx_notifications_user_target
on notifications(user_id, target_type, target_id);

create index idx_notifications_scheduled
on notifications(status, scheduled_for);

create index idx_notification_delivery_logs_user_created
on notification_delivery_logs(user_id, created_at desc);

create index idx_notification_delivery_logs_notification
on notification_delivery_logs(notification_id);

create index idx_notification_rules_enabled
on notification_rules(is_enabled, rule_key);

-- ============================================================
-- RLS
-- ============================================================

alter table notification_preferences enable row level security;
alter table notifications enable row level security;
alter table notification_delivery_logs enable row level security;
alter table notification_rules enable row level security;

drop policy if exists "Users can read own notification preferences" on notification_preferences;
drop policy if exists "Users can insert own notification preferences" on notification_preferences;
drop policy if exists "Users can update own notification preferences" on notification_preferences;

create policy "Users can read own notification preferences"
on notification_preferences
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own notification preferences"
on notification_preferences
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own notification preferences"
on notification_preferences
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read own notifications" on notifications;
drop policy if exists "Users can insert own notifications" on notifications;
drop policy if exists "Users can update own notifications" on notifications;
drop policy if exists "Users can delete own notifications" on notifications;

create policy "Users can read own notifications"
on notifications
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own notifications"
on notifications
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own notifications"
on notifications
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own notifications"
on notifications
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own notification delivery logs" on notification_delivery_logs;
drop policy if exists "Users can insert own notification delivery logs" on notification_delivery_logs;

create policy "Users can read own notification delivery logs"
on notification_delivery_logs
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own notification delivery logs"
on notification_delivery_logs
for insert
to authenticated
with check ((select auth.uid()) = user_id);

-- notification_rules は全ログインユーザーが読めてもよい設定情報。
-- 書き込みは通常APIから行わない。
drop policy if exists "Authenticated users can read enabled notification rules" on notification_rules;

create policy "Authenticated users can read enabled notification rules"
on notification_rules
for select
to authenticated
using (is_enabled = true);

-- ============================================================
-- Seed
-- ============================================================

insert into notification_rules (
  rule_key,
  notification_type,
  title_template,
  body_template,
  default_severity,
  cooldown_hours
)
values
  (
    'rule_questions_pending',
    'rule_questions_pending',
    '未回答の確認項目があります',
    '{{ticker}} の投資ルールに、まだ回答していない質問があります。',
    'info',
    24
  ),
  (
    'rule_quality_gate_failed',
    'rule_quality_gate_failed',
    'ルールに未設定項目があります',
    '{{ticker}} のルールには、損切り・最大投資比率など未設定の項目があります。',
    'warning',
    24
  ),
  (
    'rule_finalizable',
    'rule_finalizable',
    'ルールを完成版として保存できます',
    '{{ticker}} のルールは完成度が高くなっています。内容を確認して完成版として保存できます。',
    'success',
    24
  ),
  (
    'watchlist_item_needs_rule',
    'watchlist_item_needs_rule',
    'Watchlist候補をルール化できます',
    '{{ticker}} のメモが整理されています。Rule Sessionに進めるか確認しましょう。',
    'info',
    48
  ),
  (
    'portfolio_missing_rules',
    'portfolio_missing_rules',
    'ルール未設定の保有銘柄があります',
    'Portfolio内に、投資ルールがまだ紐づいていない保有銘柄があります。',
    'warning',
    24
  ),
  (
    'document_summary_completed',
    'document_summary_completed',
    '資料要約が完了しました',
    '{{title}} のAI要約が完了しました。投資ルールに反映できる確認項目を見てみましょう。',
    'success',
    0
  );
