# Next step plan: profile matrix and Kanban bootstrap

## Goal

Turn the workflow runbook into an operational setup guide that tells the team
which Hermes profiles to create and how to bootstrap Kanban for the first pilot
issue.

## Scope

1. Create a Hermes profile matrix document.
2. Create a Kanban bootstrap document with a practical first-run sequence.
3. Keep the documents aligned with ADR 0001 and the workflow runbook.

## Files to add

- `docs/hermes-profile-matrix.md`
- `docs/kanban-bootstrap.md`

## Validation

- Confirm the documents do not conflict with:
  - `docs/adr/0001-issue-driven-agent-orchestration.md`
  - `docs/agent-workflow-runbook.md`
- Note that the current container does not have a `hermes` binary available,
  so the bootstrap guide should be written as a repo-local operator reference
  rather than a verified execution log.

## Risks

- Overfitting the guide to a particular Hermes version or command syntax.
- Making the profile matrix too rigid before the actual local profile list is
  known.

## Deliverable

A concise operator guide for creating the profile roster and initializing the
first Kanban workflow pilot.
