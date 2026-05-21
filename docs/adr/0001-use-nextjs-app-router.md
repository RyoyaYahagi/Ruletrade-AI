# ADR-0001: Use Next.js App Router

## Status

Accepted

## Date

2026-05-20

## Context

App / API / Marketing / Admin / PWAを同一repoで管理したい。

## Decision

Next.js App Routerを使う。

## Consequences

Route Groups / Server Components / Route Handlersを使える。Client / Server境界を間違えない運用が必要。

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
