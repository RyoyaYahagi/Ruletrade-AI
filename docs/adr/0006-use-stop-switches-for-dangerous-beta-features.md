# ADR-0006: Use Stop Switches for Dangerous Beta Features

## Status

Accepted

## Date

2026-05-20

## Context

AI Review / RAG / Document / Billingはβ中に止める必要がある。

## Decision

launch_stop_switchesで危険機能を停止可能にする。

## Consequences

機能ごとにassertを入れる必要がある。Incident時の被害拡大を止めやすくなる。

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
