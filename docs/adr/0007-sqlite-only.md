# ADR-0007: SQLite-only backend

## Context

The application needs a predictable local backend with fast page transitions,
no external auth round-trips, and one source of truth for development and tests.

## Decision

Use SQLite for application data, local session authentication for accounts, and
server-side local file storage for uploaded documents. User-owned queries must
include an explicit `user_id` ownership condition in the service or API route.

## Consequences

- Auth, database, storage, and tests run without external services.
- SQLite schema initialization is performed by `src/lib/db/sqlite-schema.ts`.
- Session tokens and password hashes remain server-side.
- Hosted deployment must provide a durable SQLite path and storage volume.
- RAG similarity search and quota counters are implemented in the SQLite
  service layer.
