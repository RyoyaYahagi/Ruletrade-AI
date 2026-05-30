-- ============================================================
-- Ruletrade-AI Notifications MVP
-- ============================================================

-- ============================================================
-- notification_preferences
-- ============================================================

create table public.notification_preferences (
    user_id uuid not null primary key references public.app_users(id) on delete cascade,
    review_reminders_enabled boolean not null default true,
    unread_items_reminders_enabled boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.notification_preferences is 'User notification preferences for in-app reminders.';

-- ============================================================
-- notifications
-- ============================================================

create table public.notifications (
    id uuid not null default gen_random_uuid() primary key,
    user_id uuid not null references public.app_users(id) on delete cascade,
    type text not null check (type in (
        'review_reminder',
        'unanswered_question',
        'unconfigured_rule',
        'watchlist_rule_session_pending',
        'portfolio_review_pending',
        'document_summary_complete'
    )),
    title text not null,
    body text not null,
    action_url text,
    is_read boolean not null default false,
    read_at timestamptz,
    created_at timestamptz not null default now()
);

comment on table public.notifications is 'In-app notification queue for rule review reminders and other safe reminders.';

-- ============================================================
-- Indexes for RLS and query performance
-- ============================================================

create index if not exists idx_notification_preferences_user_id
on public.notification_preferences(user_id);

create index if not exists idx_notifications_user_id
on public.notifications(user_id);

create index if not exists idx_notifications_user_id_is_read_created_at
on public.notifications(user_id, is_read, created_at desc);

create index if not exists idx_notifications_user_id_created_at
on public.notifications(user_id, created_at desc);

-- ============================================================
-- Enable RLS
-- ============================================================

alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;

-- ============================================================
-- RLS Policies: notification_preferences
-- ============================================================

drop policy if exists "Users can read own notification preferences" on public.notification_preferences;
drop policy if exists "Users can insert own notification preferences" on public.notification_preferences;
drop policy if exists "Users can update own notification preferences" on public.notification_preferences;

create policy "Users can read own notification preferences"
on public.notification_preferences
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own notification preferences"
on public.notification_preferences
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own notification preferences"
on public.notification_preferences
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- ============================================================
-- RLS Policies: notifications
-- ============================================================

drop policy if exists "Users can read own notifications" on public.notifications;
drop policy if exists "Users can insert own notifications" on public.notifications;
drop policy if exists "Users can update own notifications" on public.notifications;
drop policy if exists "Users can delete own notifications" on public.notifications;

create policy "Users can read own notifications"
on public.notifications
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own notifications"
on public.notifications
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own notifications"
on public.notifications
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own notifications"
on public.notifications
for delete
to authenticated
using ((select auth.uid()) = user_id);
