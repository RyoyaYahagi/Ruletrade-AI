# ADR-0005: Do Not Store Raw AI Prompt / Output in Production Logs

## Status

Accepted

## Date

2026-05-20

## Context

Prompt / Outputには投資メモ・Document由来のprivate dataが含まれる可能性がある。

## Decision

本番ではraw prompt/output本文を原則保存しない。

## Consequences

Debugしづらくなる。代わりにrequestId, status, token count, schema_valid, safety_passedを保存する。

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
