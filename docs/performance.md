# Performance

Ruletrade-AI performance strategy:

- measure before optimizing
- keep user-owned queries scoped by user_id
- add indexes for common query patterns
- use pagination for list APIs
- avoid heavy synchronous document processing
- set AI provider timeouts
- keep analytics/logging non-blocking
- use Next.js caching only for safe data
- never weaken RLS for performance

## Critical flows

- Dashboard
- Rule Session
- AI Review
- RAG Retrieval
- Document Upload
- Privacy Delete
- Billing Settings

## Performance Budget

### Web

| Flow                             | Target |
| -------------------------------- | ------ |
| Dashboard initial render         | 2.5s   |
| Rule Session page initial render | 2.5s   |
| Document list initial render     | 3.0s   |
| Billing settings initial render  | 3.0s   |

### API

| Endpoint          | Target                           |
| ----------------- | -------------------------------- |
| GET APIs          | p95 500ms                        |
| POST rule session | p95 800ms                        |
| AI Review start   | 1s response or stream/job        |
| Document upload   | quick response, async extraction |

### DB

| Query           | Target |
| --------------- | ------ |
| Main list query | 200ms  |
| Detail query    | 100ms  |
| RAG retrieval   | 500ms  |

### AI

| Operation        | Timeout |
| ---------------- | ------- |
| AI Review        | 30s     |
| Embedding        | 20s     |
| Document Summary | 60s     |

## DB Index Guidelines

Create composite indexes on user-owned tables:

```sql
create index idx_table_user_created
on table_name(user_id, created_at desc);
```

For detail lookups:

```sql
create index idx_table_user_id_id
on table_name(user_id, id);
```

For status-filtered lists:

```sql
create index idx_table_user_status_created
on table_name(user_id, status, created_at desc);
```

## RAG Limits

- default topK: 6
- max topK: 12
- default max context chars: 6000
- max context chars: 12000
- source types allowlist
- user_id mandatory filter

## Caching Rules

### Safe to cache

- public landing pages
- legal notices
- active billing plans
- static docs links

### Cache with caution

- user dashboard
- rule session detail
- portfolio / watchlist
- notifications / privacy settings

### Never cache

- user private data shared across users
- data after privacy delete
- billing subscription after change

## Server / Client Components

### Server Component

- Dashboard shell
- Rule Session initial data
- Document list
- Billing status
- Legal / docs pages

### Client Component

- Forms
- AI Review button
- Document upload form
- Notification dropdown
- Feedback dialog

## AI Timeout Policy

```ts
const AI_TIMEOUTS = {
  ruleReviewMs: 30_000,
  watchlistReviewMs: 30_000,
  portfolioReviewMs: 30_000,
  documentSummaryMs: 60_000,
  embeddingMs: 20_000,
};
```

## Retry Policy

- AI Review: no retry on timeout, explicit re-run
- Embedding: max 1 retry on transient error
- Document extraction: job re-run button
- Billing webhook: idempotent handler
- Analytics: never block UI

## Document Job Policy

Heavy processing should be async:

- large PDF extraction
- embedding batch generation
- document summary
- RAG reindex all
- account delete cleanup

## Tools

- Vercel Speed Insights
- Supabase Performance Advisor
- PostgreSQL EXPLAIN / EXPLAIN ANALYZE
- API request logs
- Performance smoke tests

## Query Plan Check

```sql
explain analyze
select *
from rule_design_sessions
where user_id = '...'
order by created_at desc
limit 20;
```

Check:

- user_id index is used
- no unnecessary Seq Scan
- limit is effective
