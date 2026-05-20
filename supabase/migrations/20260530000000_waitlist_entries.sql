create table if not exists public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  source text not null default 'landing',
  notes text,
  status text not null default 'pending' check (status in ('pending', 'invited', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.waitlist_entries is 'Waitlist entries from public landing page.';

alter table public.waitlist_entries enable row level security;

create policy admin_only_waitlist on public.waitlist_entries
  for all using (auth.jwt()->>'role' = 'admin');

create index idx_waitlist_entries_status_created
  on public.waitlist_entries(status, created_at desc);
