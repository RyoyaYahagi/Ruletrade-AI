create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_users(id) on delete set null,
  email text not null,
  subject text not null,
  body text not null,
  category text not null default 'general' check (
    category in ('general', 'auth', 'ai_review', 'rag', 'document', 'privacy', 'billing', 'security', 'bug', 'feedback')
  ),
  priority text not null default 'medium' check (
    priority in ('low', 'medium', 'high', 'critical')
  ),
  status text not null default 'open' check (
    status in ('open', 'pending', 'resolved', 'closed', 'escalated')
  ),
  request_id text,
  current_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

 comment on table public.support_tickets is 'User support tickets.';

 create trigger set_support_tickets_updated_at
 before update on public.support_tickets
 for each row execute function set_updated_at();

 create index idx_support_tickets_user_created
 on public.support_tickets(user_id, created_at desc);

 create index idx_support_tickets_status_priority
 on public.support_tickets(status, priority);

alter table public.support_tickets enable row level security;
 create policy own_support_tickets on public.support_tickets
 for select using (user_id = auth.uid());
 create policy admin_support_tickets on public.support_tickets
 for all using (auth.jwt()->>'role' = 'admin');

create table if not exists public.support_ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  user_id uuid references app_users(id) on delete set null,
  author_role text not null default 'user' check (author_role in ('user', 'admin', 'system')),
  body text not null,
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

 comment on table public.support_ticket_comments is 'Comments on support tickets.';

 create index idx_support_ticket_comments_ticket
 on public.support_ticket_comments(ticket_id, created_at desc);

alter table public.support_ticket_comments enable row level security;
 create policy own_ticket_comments on public.support_ticket_comments
 for select using (
   user_id = auth.uid() and is_internal = false
 );
 create policy admin_ticket_comments on public.support_ticket_comments
 for all using (auth.jwt()->>'role' = 'admin');

create table if not exists public.support_help_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text not null,
  content text not null,
  order_index int not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

 comment on table public.support_help_articles is 'Public help center articles.';

 create trigger set_support_help_articles_updated_at
 before update on public.support_help_articles
 for each row execute function set_updated_at();

alter table public.support_help_articles enable row level security;
 create policy public_help_articles on public.support_help_articles
 for select using (is_published = true);
 create policy admin_help_articles on public.support_help_articles
 for all using (auth.jwt()->>'role' = 'admin');
