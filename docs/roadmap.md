# Roadmap

Ruletrade-AI manages work through:

- themes
- initiatives
- milestones
- issues
- release plans

## Principles

- Roadmap is direction, not a promise.
- Internal roadmap can include risks and blockers.
- Public roadmap must not expose security or privacy-sensitive details.
- Release phase determines what can ship.

## Hierarchy

### Level 1: Theme

Large strategic directions (e.g., Rule Creation, AI Safety, RAG Memory, Document Intelligence, Privacy / Trust, Beta Launch, Monetization, Mobile / PWA, Operations).

### Level 2: Initiative

Cross-issue groupings (e.g., Closed Beta Readiness, Privacy Delete Complete Flow, AI Review Safety Gate, Document RAG MVP, Admin Operations MVP, Public Marketing MVP).

### Level 3: Milestone

Shippable units (e.g., M0 Internal Alpha, M1 Private Beta, M2 Expanded Beta, M3 Release Candidate, M4 Public Landing, M5 Open Beta).

### Level 4: Issue

Implementation units tracked in GitHub Issues.

## Public Roadmap

Public roadmap items are stored in `product_roadmap_items` and exposed via `/api/roadmap`.

Only items with `is_public = true` are visible to unauthenticated users.

Internal status, risk level, and release blockers are never exposed publicly.
