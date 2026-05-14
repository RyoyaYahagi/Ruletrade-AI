# Next step plan: workflow runbook and issue record template

## Goal

Add the next layer of durable workflow documentation after ADR 0001 so the
Ruletrade-AI team can actually run the issue-driven multi-agent process.

## Scope

1. Create a runbook describing:
   - recommended Hermes profiles
   - how Kanban cards map to issue phases
   - how Kimi/OpenCode Go and Copilot workers should be assigned
   - suggested CLI flow for operating the board
2. Create a per-issue execution record template under `docs/issues/`.
3. Keep changes documentation-only.

## Files to add

- `docs/agent-workflow-runbook.md`
- `docs/issues/README.md`
- `docs/issues/_template.md`

## Validation

- Confirm docs are internally consistent with:
  - `docs/adr/0001-issue-driven-agent-orchestration.md`
  - `docs/architecture.md`
  - `docs/ai-agent-guidelines.md`
- No code/build validation required because this step is docs-only.

## Risks

- Over-specifying exact commands that may differ across Hermes versions.
- Mixing product-runtime AI rules with engineering-workflow rules.

## Deliverable

A practical runbook plus issue-record template that can be used in the next turn
to set up actual Hermes profiles and Kanban tasks.
