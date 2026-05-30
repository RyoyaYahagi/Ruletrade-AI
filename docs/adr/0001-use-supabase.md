# ADR 0001: Use Supabase

## Status

Accepted

## Context

Ruletrade-AI needs authentication, Postgres, storage, RLS, and pgvector.

## Decision

Use Supabase for Auth, Postgres, Storage, and RLS.

## Consequences

Positive:

- integrated auth and database
- RLS support
- pgvector support
- storage integration

Negative:

- vendor dependency
- RLS design must be carefully tested
