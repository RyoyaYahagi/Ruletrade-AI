# Issue Execution Records

Use this directory for durable per-issue implementation records.

## Purpose

A GitHub issue is the intake and discussion surface.
A file in `docs/issues/` is the durable execution record for what happened in
this repository while implementing that issue.

These records help preserve:

- why this issue was selected next
- where the saved plan lives
- which Kanban tasks were created
- what files changed
- what tests were run
- what blockers or clarification needs appeared
- what ADRs or docs changed because of the work
- what the final reviewer concluded

## Naming

Use:

- `docs/issues/<issue-number>.md`

Example:

- `docs/issues/92.md`

## How to start a new record

1. Copy `docs/issues/_template.md`
2. Fill in the issue metadata
3. Update the record throughout execution, not only at the end
4. Link the saved plan under `.hermes/plans/`
5. Record blockers and final verification outcome

## Relationship to other artifacts

- ADRs in `docs/adr/` capture durable engineering or architecture decisions.
- `.hermes/plans/` stores pre-implementation plans.
- GitHub issue comments provide discussion and status updates.
- Discord provides operational reporting, especially for blockers.

The `docs/issues/` record is the repo-local execution log that ties those
artifacts together.
