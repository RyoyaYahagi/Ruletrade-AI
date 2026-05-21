# ADR-0004: Keep AI Provider Calls Server-Side

## Status

Accepted

## Date

2026-05-20

## Context

AI API keyとprivate user dataを守る必要がある。

## Decision

AI providerはserver-side serviceからのみ呼ぶ。

## Consequences

Client実装は少し増える。API key露出リスクを下げられる。

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
