# ADR-0003: Use RLS for User-Owned Data

## Status

Accepted

## Date

2026-05-20

## Context

投資メモ・Document・RAG chunksなどuser-owned private dataが多い。

## Decision

user-owned tableは原則RLSを必須にする。

## Consequences

Query設計とtestが重くなる。ただしcross-user data leakリスクを下げられる。

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
