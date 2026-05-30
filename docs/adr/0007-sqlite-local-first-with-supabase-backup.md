# ADR-0007: Use SQLite Locally While Preserving Supabase

## Status

Accepted

## Date

2026-05-23

## Context

The project needs a simpler local database path now, but may return to Supabase
later for hosted Auth, Postgres, Storage, and RLS.

## Decision

Use SQLite as the default local database provider through `DB_PROVIDER=sqlite`.
Keep the Supabase implementation in the codebase and switch back with
`DB_PROVIDER=supabase` when hosted Supabase is needed.

The Supabase-based `develop` state is also preserved in Git at:

```text
backup/develop-supabase-20260523
```

## Consequences

SQLite does not provide Supabase Auth, Storage, realtime, RPC, or RLS. These
capabilities are intentionally out of scope for the SQLite local-first path.
The SQLite adapter returns explicit `SQLITE_UNSUPPORTED` errors for Supabase
Storage, Auth admin/callback, and RPC calls instead of pretending the operation
succeeded.

Server code must continue to enforce user ownership explicitly and browser code
must not access privileged data directly. Local development auth uses the
existing mock-user environment variables.

SQLite data is stored at `SQLITE_DATABASE_PATH`, defaulting to
`./data/ruletrade.sqlite`.

## Supabase Restore Path

To restore the Supabase implementation:

1. Switch to or diff against `backup/develop-supabase-20260523`.
2. Set `DB_PROVIDER=supabase`.
3. Restore the Supabase environment variables.
4. Re-run Supabase migrations and RLS verification before enabling hosted use.
