# ADR-0002: Use Supabase for Auth / Postgres / Storage

## Status

Accepted

## Date

2026-05-20

## Context

MVPでAuth, DB, Storage, RLSをまとめて扱いたい。

## Decision

Supabaseを中核backendとして使う。

## Consequences

RLSを前提にした設計が必要。Storage object backupはDB backupと分ける必要がある。

## Alternatives considered

- Option A: 別々のrepoで管理
- Option B: 別のフレームワークを使う
- Option C: 別のbackend serviceを使う

## Security impact

この決定はauth, session, data isolationに影響する。

## Privacy impact

user-owned dataの取り扱いに影響する。

## Operational impact

monitoring, backup, release rollbackに影響する。

## Related issues

- Issue #82

## References

- docs/adr.md
