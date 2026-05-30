-- ============================================================
-- RAG MVP
-- ============================================================

create extension if not exists vector;

create table rag_documents (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,

  source_type text not null check (
    source_type in (
      'investor_profile',
      'rule_session',
      'rule_version',
      'rule_review',
      'watchlist_item',
      'watchlist_review',
      'portfolio_position',
      'portfolio_review',
      'trade_reflection',
      'manual_note'
    )
  ),

  source_id uuid not null,

  title text not null,

  content text not null,

  metadata jsonb not null default '{}'::jsonb,

  content_hash text not null,

  embedding_status text not null default 'pending' check (
    embedding_status in (
      'pending',
      'embedded',
      'failed',
      'stale',
      'disabled'
    )
  ),

  last_embedded_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, source_type, source_id)
);

create trigger set_rag_documents_updated_at
before update on rag_documents
for each row
execute function set_updated_at();

create table rag_chunks (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,

  document_id uuid not null references rag_documents(id) on delete cascade,

  source_type text not null,
  source_id uuid not null,

  chunk_index int not null check (
    chunk_index >= 0
  ),

  content text not null,

  content_hash text not null,

  embedding_model text not null,
  embedding_provider text not null,

  embedding vector(1536),

  token_count int check (
    token_count is null
    or token_count >= 0
  ),

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (document_id, chunk_index)
);

create trigger set_rag_chunks_updated_at
before update on rag_chunks
for each row
execute function set_updated_at();

create table rag_retrieval_logs (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,

  request_id uuid,

  task_type text not null check (
    task_type in (
      'rule_review',
      'question_generation',
      'portfolio_review',
      'watchlist_review',
      'reflection_review',
      'document_rag_review',
      'eval'
    )
  ),

  query_text text not null,

  query_embedding_model text,
  query_embedding_provider text,

  match_threshold float not null default 0.75,
  match_count int not null default 8,

  retrieved_chunk_ids uuid[] not null default '{}',

  retrieved_count int not null default 0,

  metadata jsonb not null default '{}'::jsonb,

  latency_ms int check (
    latency_ms is null
    or latency_ms >= 0
  ),

  created_at timestamptz not null default now()
);

create table embedding_jobs (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,

  document_id uuid not null references rag_documents(id) on delete cascade,

  status text not null default 'pending' check (
    status in (
      'pending',
      'processing',
      'succeeded',
      'failed',
      'cancelled'
    )
  ),

  provider text not null,
  model text not null,

  error_message text,

  started_at timestamptz,
  completed_at timestamptz,

  created_at timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================

create index idx_rag_documents_user_source
on rag_documents(user_id, source_type, source_id);

create index idx_rag_documents_user_status
on rag_documents(user_id, embedding_status);

create index idx_rag_chunks_user_document
on rag_chunks(user_id, document_id);

create index idx_rag_chunks_user_source
on rag_chunks(user_id, source_type, source_id);

create index idx_rag_retrieval_logs_user_created
on rag_retrieval_logs(user_id, created_at desc);

create index idx_embedding_jobs_user_status
on embedding_jobs(user_id, status, created_at desc);

-- cosine distance用
create index idx_rag_chunks_embedding_hnsw
on rag_chunks
using hnsw (embedding vector_cosine_ops);

-- ============================================================
-- RLS
-- ============================================================

alter table rag_documents enable row level security;
alter table rag_chunks enable row level security;
alter table rag_retrieval_logs enable row level security;
alter table embedding_jobs enable row level security;

drop policy if exists "Users can read own rag documents" on rag_documents;
drop policy if exists "Users can insert own rag documents" on rag_documents;
drop policy if exists "Users can update own rag documents" on rag_documents;
drop policy if exists "Users can delete own rag documents" on rag_documents;

create policy "Users can read own rag documents"
on rag_documents
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own rag documents"
on rag_documents
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own rag documents"
on rag_documents
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own rag documents"
on rag_documents
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own rag chunks" on rag_chunks;
drop policy if exists "Users can insert own rag chunks" on rag_chunks;
drop policy if exists "Users can update own rag chunks" on rag_chunks;
drop policy if exists "Users can delete own rag chunks" on rag_chunks;

create policy "Users can read own rag chunks"
on rag_chunks
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own rag chunks"
on rag_chunks
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own rag chunks"
on rag_chunks
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own rag chunks"
on rag_chunks
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own rag retrieval logs" on rag_retrieval_logs;
drop policy if exists "Users can insert own rag retrieval logs" on rag_retrieval_logs;

create policy "Users can read own rag retrieval logs"
on rag_retrieval_logs
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own rag retrieval logs"
on rag_retrieval_logs
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read own embedding jobs" on embedding_jobs;
drop policy if exists "Users can insert own embedding jobs" on embedding_jobs;
drop policy if exists "Users can update own embedding jobs" on embedding_jobs;

create policy "Users can read own embedding jobs"
on embedding_jobs
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own embedding jobs"
on embedding_jobs
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own embedding jobs"
on embedding_jobs
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- ============================================================
-- RPC: match_rag_chunks
-- ============================================================

create or replace function match_rag_chunks (
  p_user_id uuid,
  p_query_embedding vector(1536),
  p_match_threshold float,
  p_match_count int,
  p_source_types text[] default null
)
returns table (
  id uuid,
  document_id uuid,
  source_type text,
  source_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
as $$
  select
    c.id,
    c.document_id,
    c.source_type,
    c.source_id,
    c.content,
    c.metadata,
    1 - (c.embedding <=> p_query_embedding) as similarity
  from rag_chunks c
  where c.user_id = p_user_id
    and c.embedding is not null
    and (
      p_source_types is null
      or c.source_type = any(p_source_types)
    )
    and 1 - (c.embedding <=> p_query_embedding) >= p_match_threshold
  order by c.embedding <=> p_query_embedding
  limit p_match_count;
$$;
