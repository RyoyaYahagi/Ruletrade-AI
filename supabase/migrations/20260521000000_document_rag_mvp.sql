-- ============================================================
-- Document RAG MVP
-- ============================================================

-- user_documents

create table user_documents (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,

  title text not null,

  original_filename text not null,

  storage_bucket text not null default 'documents',
  storage_path text not null,

  mime_type text not null,

  file_size_bytes bigint not null check (
    file_size_bytes >= 0
  ),

  document_type text not null default 'other' check (
    document_type in (
      'earnings_material',
      'annual_report',
      'ir_material',
      'research_note',
      'news_note',
      'manual_note',
      'other'
    )
  ),

  ticker text,
  company_name text,

  source_url text,

  extraction_status text not null default 'pending' check (
    extraction_status in (
      'pending',
      'processing',
      'extracted',
      'failed',
      'skipped'
    )
  ),

  rag_status text not null default 'pending' check (
    rag_status in (
      'pending',
      'indexed',
      'failed',
      'stale',
      'disabled'
    )
  ),

  extracted_text text,

  extracted_text_hash text,

  metadata jsonb not null default '{}'::jsonb,

  uploaded_at timestamptz not null default now(),
  extracted_at timestamptz,
  indexed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, storage_path)
);

create trigger set_user_documents_updated_at
before update on user_documents
for each row
execute function set_updated_at();

-- document_extraction_jobs

create table document_extraction_jobs (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,
  document_id uuid not null references user_documents(id) on delete cascade,

  status text not null default 'pending' check (
    status in (
      'pending',
      'processing',
      'succeeded',
      'failed',
      'cancelled'
    )
  ),

  extractor text not null default 'local',

  error_message text,

  started_at timestamptz,
  completed_at timestamptz,

  created_at timestamptz not null default now()
);

-- document_summaries

create table document_summaries (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,
  document_id uuid not null references user_documents(id) on delete cascade,

  provider text not null,
  model text not null,
  prompt_version text not null,

  summary_json jsonb not null,

  summary text,
  key_points text[] not null default '{}',
  risks text[] not null default '{}',
  questions text[] not null default '{}',

  safety_passed boolean not null default true,
  schema_valid boolean not null default true,

  input_tokens int check (
    input_tokens is null
    or input_tokens >= 0
  ),

  output_tokens int check (
    output_tokens is null
    or output_tokens >= 0
  ),

  estimated_cost_usd numeric(10,6) check (
    estimated_cost_usd is null
    or estimated_cost_usd >= 0
  ),

  latency_ms int check (
    latency_ms is null
    or latency_ms >= 0
  ),

  error_message text,

  created_at timestamptz not null default now()
);

-- document_rag_links

create table document_rag_links (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references app_users(id) on delete cascade,

  document_id uuid not null references user_documents(id) on delete cascade,

  target_type text not null check (
    target_type in (
      'rule_session',
      'watchlist_item',
      'portfolio_position',
      'portfolio',
      'manual'
    )
  ),

  target_id uuid,

  link_reason text,

  created_at timestamptz not null default now(),

  unique (user_id, document_id, target_type, target_id)
);

-- ============================================================
-- Indexes
-- ============================================================

create index idx_user_documents_user_created
on user_documents(user_id, created_at desc);

create index idx_user_documents_user_ticker
on user_documents(user_id, ticker);

create index idx_user_documents_user_status
on user_documents(user_id, extraction_status, rag_status);

create index idx_document_extraction_jobs_user_status
on document_extraction_jobs(user_id, status, created_at desc);

create index idx_document_summaries_user_document
on document_summaries(user_id, document_id, created_at desc);

create index idx_document_rag_links_user_target
on document_rag_links(user_id, target_type, target_id);

create index idx_document_rag_links_document
on document_rag_links(document_id);

-- ============================================================
-- RLS
-- ============================================================

alter table user_documents enable row level security;
alter table document_extraction_jobs enable row level security;
alter table document_summaries enable row level security;
alter table document_rag_links enable row level security;

drop policy if exists "Users can read own documents" on user_documents;
drop policy if exists "Users can insert own documents" on user_documents;
drop policy if exists "Users can update own documents" on user_documents;
drop policy if exists "Users can delete own documents" on user_documents;

create policy "Users can read own documents"
on user_documents
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own documents"
on user_documents
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own documents"
on user_documents
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own documents"
on user_documents
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own document extraction jobs" on document_extraction_jobs;
drop policy if exists "Users can insert own document extraction jobs" on document_extraction_jobs;
drop policy if exists "Users can update own document extraction jobs" on document_extraction_jobs;

create policy "Users can read own document extraction jobs"
on document_extraction_jobs
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own document extraction jobs"
on document_extraction_jobs
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own document extraction jobs"
on document_extraction_jobs
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read own document summaries" on document_summaries;
drop policy if exists "Users can insert own document summaries" on document_summaries;

create policy "Users can read own document summaries"
on document_summaries
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own document summaries"
on document_summaries
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read own document rag links" on document_rag_links;
drop policy if exists "Users can insert own document rag links" on document_rag_links;
drop policy if exists "Users can delete own document rag links" on document_rag_links;

create policy "Users can read own document rag links"
on document_rag_links
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own document rag links"
on document_rag_links
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can delete own document rag links"
on document_rag_links
for delete
to authenticated
using ((select auth.uid()) = user_id);
