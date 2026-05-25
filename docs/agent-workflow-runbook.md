# Agent Workflow Runbook

This runbook explains how to operate the Ruletrade-AI engineering workflow
adopted in `docs/adr/0001-issue-driven-agent-orchestration.md`.

This is an engineering-process document. It does not change the product runtime
rules that keep investment-rule generation, review, evidence, explanation, and
approval separate.

## Purpose

Use this runbook when implementing Ruletrade-AI issues through Hermes with:

- issue-driven intake
- plan-first execution
- Kanban as the durable task board
- role-specific Hermes profiles
- explicit delegate target profiles when a task should run on a model different
  from the current session model
- Discord reporting for progress and blockers
- per-issue execution records in `docs/issues/`
- Hermes home roles in `docs/hermes-home-roles.md`
- memory environment guidance in `docs/memory-environment.md`

## Workflow summary

```text
GitHub issue
  -> orchestrator selects next issue
  -> planner saves plan in .hermes/plans/
  -> orchestrator decomposes issue into Kanban cards
  -> worker profiles implement assigned tasks
  -> final reviewer verifies issue outcome
  -> issue record and docs/ADR updates are saved
```

## Recommended Hermes profiles

These are recommended profile families, not product-facing agent roles.

### Core leaders

- `rt-orchestrator-kimi26`
  - purpose: intake, decomposition, routing, status tracking, and completion
    decisions before final review
  - model intent: Kimi K2.6
  - provider rule: OpenCode Go plan
  - primary tools: kanban, file, terminal, session_search, skills

- `rt-planner-kimi26`
  - purpose: produce issue implementation plans in plan mode
  - model intent: Kimi K2.6
  - primary tools: file, terminal, skills
  - expected output: `.hermes/plans/...issue-<n>...md`

- `rt-implementer-kimi26`
  - purpose: own sensitive or central implementation tasks
  - model intent: Kimi K2.6
  - provider path: OpenCode Go-backed worker path
  - primary tools: file, terminal, skills

- `rt-finalcheck-gpt55low`
  - purpose: final code review, verification, regression-oriented signoff
  - model intent: GPT-5.5 low
  - primary tools: file, terminal, skills

### Specialized workers

- `rt-worker-copilot-gpt54mini`
  - purpose: lightweight coding, bounded test work, small refactors, grep-and-fix
    style tasks
  - model intent: GPT-5.4 mini
  - provider rule: GitHub Copilot only

- `rt-worker-opencode-kimi26`
  - purpose: Kimi-based implementation or analysis tasks run through OpenCode
  - model intent: Kimi K2.6
  - provider rule: OpenCode Go plan

- `rt-worker-deepseek-v4pro`
  - purpose: independent medium-weight implementation, review, or analysis
  - model intent: DeepSeek v4 Pro or equivalent

- `rt-worker-opencode-deepseek-v4flash`
  - purpose: low-cost straightforward code implementation, small refactors,
    focused tests, and bounded fixups
  - model intent: DeepSeek v4 Flash
  - provider rule: OpenCode Go plan

## Provider routing rules

These rules apply to the engineering workflow only.

1. GPT-5.4 mini work must use GitHub Copilot provider.
2. Kimi and similar China-model workloads should be routed through the
   OpenCode Go plan.
3. Orchestrator should use Kimi K2.6 through OpenCode Go. GPT-5.5 low remains
   the escalation and final-review profile, not the default implementation
   commander.
4. If any non-orchestrator model hits a provider, quota, or capability limit,
   report the limitation on Discord rather than silently falling back.
5. Final verification should not be performed by the same profile that led
   implementation.
6. Product runtime provider calls remain governed by the server-side provider
   boundary in `docs/architecture.md`.
7. `delegate_task` calls must be routed by explicit target profile whenever the
   desired worker model differs from the current session model.
8. Simple implementation slices from a Kimi K2.6 session should prefer
   `rt-worker-opencode-deepseek-v4flash` when the acceptance criteria are clear
   and the expected savings justify a lower-capability worker.

## Kanban board model

Recommended lifecycle:

```text
triage -> planning -> ready -> implementing -> review -> done
                          \-> blocked
```

### Card types

Recommended cards per issue:

- issue-level orchestrator card
- planning card
- implementation card(s)
- test/verification card
- docs/ADR/issue-record card
- final-review card

### Dependency pattern

Use parent-child relationships for real dependencies.

Typical pattern:

```text
Issue intake
  -> Plan issue
  -> Implement schema/service/UI tasks
  -> Run tests and verification
  -> Update docs/ADR/issue record
  -> Final review
```

Parallelize only tasks that do not meaningfully overlap in file ownership or
required inputs.

## Operating procedure

### 1. Select the next issue

The orchestrator should choose the next issue using the ADR priority rule:

1. active-priority over backlog-later
2. milestone-linked over non-milestone
3. oldest issue within the same priority band
4. backlog-later only when no active-priority issue remains or the user picks it

### 2. Create the issue-level execution record

Before implementation starts, create or claim the issue record under:

- `docs/issues/<issue-number>.md`

If this is the first work on that issue, start from `docs/issues/_template.md`.

### 3. Create the plan

The planner profile must save a plan before implementation starts:

- `.hermes/plans/YYYY-MM-DD_HHMMSS-issue-<n>-<slug>.md`

The plan should identify:

- issue summary
- assumptions
- likely files to change
- tests and checks
- doc/ADR impact
- open questions
- intended Discord checkpoints

### 4. Create Kanban cards

Create at least:

1. issue orchestrator card
2. planning card
3. implementation cards
4. tests/verification card
5. docs/issue-record card
6. final-review card

Example command shapes:

```bash
hermes kanban init
hermes kanban create --title "Issue #92 orchestration" --assignee rt-orchestrator-kimi26
hermes kanban create --title "Plan issue #92" --assignee rt-planner-kimi26
hermes kanban create --title "Implement routing config" --assignee rt-implementer-kimi26
hermes kanban create --title "Add targeted tests" --assignee rt-worker-copilot-gpt54mini
hermes kanban create --title "Final verification for issue #92" --assignee rt-finalcheck-gpt55low
```

Exact flags may vary by Hermes version; treat these as operational examples.

### 5. Run workers

Use actual configured Hermes profiles only. Do not invent assignee names.

Assignment guidance:

- central workflow or high-context implementation -> `rt-implementer-kimi26`
- small bounded coding/test tasks -> `rt-worker-copilot-gpt54mini`
- Kimi/OpenCode Go specific work -> `rt-worker-opencode-kimi26`
- simple low-cost OpenCode Go implementation -> `rt-worker-opencode-deepseek-v4flash`
- independent medium analysis/implementation -> `rt-worker-deepseek-v4pro`

For short synchronous subtasks, use `delegate_task` only when the tool supports
an explicit target profile or model override. A Kimi session delegating a simple
implementation task should target `rt-worker-opencode-deepseek-v4flash`; it
should not rely on the delegate inheriting the current Kimi model.

### 6. Handle blockers

If work cannot proceed because of missing product direction, environment failure,
credential/provider failure, or architecture ambiguity:

- move the task to blocked
- add a Kanban comment describing the blocker
- send a Discord blocker report
- record the blocker in `docs/issues/<issue-number>.md`

A blocker report should include:

- issue number
- task name
- immediate cause
- what input or decision is required to unblock
- whether other tasks can continue in parallel

### 7. Final review

Before considering the issue complete:

- run the required checks for the scope
- update the issue record
- route final review to `rt-finalcheck-gpt55low`

Expected minimum verification when relevant:

```bash
npm run lint
npm run typecheck
npm run build
```

For UI or workflow-sensitive issues, add targeted inspection or browser testing.

## Discord reporting policy

Send messages at these transitions:

1. issue started
2. plan saved
3. blocker or clarification needed
4. implementation complete, entering final review
5. final review outcome

Suggested message shapes:

- start: `Starting issue #<n> <title>. Planner assigned.`
- plan: `Plan saved for issue #<n>: <path>`
- blocker: `Blocked on issue #<n>, task <name>. Need: <decision/input>`
- pre-final: `Implementation complete for issue #<n>. Running final verification.`
- final: `Issue #<n> verification result: <pass/fixes-needed>.`

## Issue record policy

Each issue record should capture:

- title and URL
- current status
- selected priority rationale
- plan path
- Kanban task summary
- files changed
- tests run
- blockers/questions
- docs/ADR changes
- final reviewer verdict

Use `docs/issues/_template.md` as the starting point.

## Scope guardrails

This workflow must not blur the product safety rules.

Do not use engineering convenience to weaken:

- structured-rule source-of-truth rules
- review and approval separation
- provider secret boundaries
- blocker visibility
- auditability requirements

When an issue creates a durable new rule, update local docs or ADRs instead of
leaving the decision only in GitHub comments or Discord history.

## Suggested next setup step

After this runbook exists, the next operational step is:

1. create the Hermes profiles listed here
2. initialize a Kanban board
3. choose one issue for a pilot run
4. use the issue template and plan workflow on that pilot
