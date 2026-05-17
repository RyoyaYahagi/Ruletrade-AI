# Kanban Bootstrap Guide

This guide describes the first operational Kanban setup for the Ruletrade-AI
engineering workflow.

It assumes the workflow defined in:

- `docs/adr/0001-issue-driven-agent-orchestration.md`
- `docs/agent-workflow-runbook.md`
- `docs/hermes-profile-matrix.md`

## Purpose

Use Kanban as the durable task board for issue execution.
Each issue should be represented by a small task graph so planning,
implementation, verification, and documentation remain separated.

## Recommended board lifecycle

```text
triage -> planning -> ready -> implementing -> review -> done
                          \-> blocked
```

## Bootstrap sequence

### 1. Create the board

Initialize the board once for the workspace.

Representative command shape:

```bash
hermes kanban init
```

If your Hermes version uses a different board layout or requires a named board,
follow the local CLI help and preserve the same lifecycle above.

### 2. Verify the configured profiles

Before creating cards, make sure the profile names you intend to assign actually
exist.

Expected families:

- `rt-orchestrator-gpt54m`
- `rt-planner-kimi26`
- `rt-implementer-kimi26`
- `rt-finalcheck-gpt55low`
- `rt-worker-copilot-gpt54mini`
- `rt-worker-opencode-kimi26`
- `rt-worker-deepseek-v4pro`

If a profile does not exist, create or rename it before assigning work.

### 3. Pick one pilot issue

Start with a single issue that is not obviously blocked and does not require a
large cross-cutting refactor.

Prefer:

- an active-priority issue
- a small-to-medium slice with clear file ownership
- work that can demonstrate planning, implementation, and final review in one run

Avoid using a backlog-later issue for the first pilot unless you explicitly want
to test the process on deferred work.

### 4. Create the issue-level card

Create a parent card for the issue itself.

Suggested title pattern:

- `Issue #<n> orchestration`

Assignee:

- `rt-orchestrator-gpt54m`

Purpose:

- own the workflow, not the code
- track status and handoffs
- decide when to escalate or block

### 5. Create the planning card

Create a planning card that depends on issue intake.

Suggested title pattern:

- `Plan issue #<n>`

Assignee:

- `rt-planner-kimi26`

Output expectation:

- a saved plan under `.hermes/plans/`

### 6. Split implementation into task cards

Create cards for each independent slice.

Good task examples:

- schema/domain change
- service/backend change
- UI change
- targeted tests
- issue record or ADR update

Assignment guidance:

- core implementation: `rt-implementer-kimi26`
- small bounded edits/tests: `rt-worker-copilot-gpt54mini`
- Kimi/OpenCode-specific work: `rt-worker-opencode-kimi26`
- independent analysis: `rt-worker-deepseek-v4pro`

Only make tasks parallel when they do not overlap materially.

### 7. Create the verification card

Once implementation cards exist, add a verification card that depends on the
implementation and test cards.

Suggested title pattern:

- `Final verification for issue #<n>`

Assignee:

- `rt-finalcheck-gpt55low`

This card should not start until the implementation tasks are complete.

### 8. Create the docs/record card

Add a card for the repo-local execution record and any durable doc changes.

Possible responsibilities:

- update `docs/issues/<issue-number>.md`
- update or create an ADR
- update runbook or profile matrix if the process itself changed

## Practical card pattern

A simple first pilot can look like this:

```text
Issue orchestration card
  -> Plan card
  -> Implementation card A
  -> Implementation card B
  -> Tests/verification card
  -> Docs/record card
  -> Final review card
```

If a task depends on another task, encode that dependency in the board rather
than relying on prose.

## Blocker handling

If a task cannot continue:

1. move it to blocked
2. leave a clear comment describing the blocker
3. report it on Discord
4. record it in the issue execution file
5. unblock or reassign only after the missing input arrives

## Completion criteria

Do not mark the issue done until all of the following are true:

- plan saved
- implementation complete
- verification passed
- docs/records updated
- final review completed by `rt-finalcheck-gpt55low`

## What to do if Hermes syntax differs

This guide intentionally avoids over-claiming exact CLI syntax because the local
Hermes binary is not available in the current environment. If your installed
version differs, keep the same board structure and lifecycle while following the
local CLI help for exact flags.
