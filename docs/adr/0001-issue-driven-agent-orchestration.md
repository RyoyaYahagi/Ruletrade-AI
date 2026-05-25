# ADR 0001: Issue-driven multi-agent orchestration for Ruletrade-AI implementation

- Status: Accepted
- Date: 2026-05-14

## Context

Ruletrade-AI is a safety-sensitive product for drafting, reviewing, and approving
investment rules. The repository already establishes several durable constraints:

- structured rule data is the source of truth
- generation, review, evaluation, explanation, and approval must remain separate
- durable workflow rules should be recorded in local docs and tests, not only in
  GitHub issue text
- user-facing outputs must not imply financial certainty or bypass review

The implementation workflow for this repository also needs stronger operational
structure. The desired engineering workflow is:

- pick the next GitHub issue from an explicit queue
- create and save a plan before implementation
- split work into task-scoped agents rather than using one generalist agent for
  the whole issue
- record results per issue
- update ADRs or local docs when a durable design decision is made
- report progress, blockers, and questions to Discord
- reserve a final verification pass for a dedicated review model

A plain single-session agent loop is not durable enough for this workflow. It
lacks persistent task state, explicit assignment, and robust recovery when tasks
block or a worker crashes.

## Decision

Ruletrade-AI implementation work will use an issue-driven, plan-first,
Kanban-backed multi-agent workflow.

### Core workflow

1. An orchestrator selects the next issue from GitHub using an explicit priority
   rule.
2. A planning agent creates a plan in plan mode and saves it under
   `.hermes/plans/` before any implementation begins.
3. The issue is decomposed into task-sized Kanban cards.
4. Each task is assigned to a dedicated agent profile.
5. Parallel execution is allowed only for tasks without meaningful file or data
   dependency overlap.
6. Blockers, clarification needs, and major phase transitions are reported to
   Discord.
7. Every issue produces a durable execution record.
8. A final verification gate is performed by a dedicated reviewer model before
   the issue is considered complete.

### Durable control plane

Hermes Kanban is the system of record for in-flight engineering work.

Kanban is preferred over plain `delegate_task` for this workflow because it
provides:

- durable task state across restarts
- explicit assignee routing via Hermes profiles
- dependency management between planning, implementation, and review tasks
- comments and audit trail for blockers and handoffs
- a recovery path for failed or stuck workers

`delegate_task` remains acceptable for short, synchronous subtasks inside a
single execution step, but not as the primary orchestration mechanism for
issue-level work.

### Model leadership and routing

The workflow uses role-specific leader models.

- Orchestrator: Kimi K2.6 through OpenCode Go
- Planning lead: Kimi K2.6
- Implementation lead: Kimi K2.6
- Final verification lead: GPT-5.5 low
- Escalation for unusually difficult design or verification questions:
  GPT-5.5 low
- If a non-orchestrator model hits a provider or quota limit, report the limitation
  on Discord rather than silently falling back.

Worker models are chosen by task complexity.

- Lightweight coding or bounded review tasks may use GPT-5.4 mini.
- When GPT-5.4 mini is used, the provider must be GitHub Copilot.
- Simple low-cost implementation tasks may use DeepSeek v4 Flash through the
  OpenCode Go plan when Kimi has already defined the task scope.
- Medium-weight independent tasks may use DeepSeek v4 Pro or another suitable
  worker model.
- Kimi and related China-model workloads are expected to run through the
  OpenCode Go plan rather than direct per-task ad hoc configuration.

### Provider and execution policy

This ADR governs development-agent orchestration only. It does not change the
product runtime provider boundary described elsewhere in the architecture docs.

For engineering workflow execution:

- Hermes profiles should pin leader and worker providers/models.
- Kimi and similar China-model tasks should be routed through an OpenCode-based
  worker path backed by the OpenCode Go plan.
- `delegate_task` should accept an explicit target profile or model override
  for short synchronous subtasks. When omitted, inheriting the current session
  model is acceptable for compatibility, but cost-saving routes should pass the
  intended worker profile explicitly.
- GPT-5.4 mini worker tasks should use the GitHub Copilot provider.
- Final review should remain isolated from implementation so that the reviewer
  can assess the issue outcome independently.

### Hermes home roles

The current execution environment uses two Hermes home paths with fixed roles:

- `/root/.hermes` is the active session home for the running container user.
- `/home/yappa/.hermes` is the compatibility path kept for repo-workflow memory
  and lock-based operations.

Operational rules:

- Treat `/root/.hermes` as the active Hermes home for session state, cache, and
  root-side configuration.
- Keep `/home/yappa/.hermes` available when memory or lock-based tooling expects
  the repo workflow path.
- Do not assume the two paths mirror each other automatically.
- If a tool fails because of a lock or path mismatch, verify which Hermes home it
  is actually using before changing workflow behavior.

### Required artifacts per issue

Each implemented issue should produce, at minimum:

1. a saved plan under `.hermes/plans/`
2. a Kanban task graph showing decomposition and status
3. an issue execution record, recommended path `docs/issues/<issue-number>.md`
4. a GitHub issue update summarizing implementation status and follow-up items
5. a Discord report covering start, plan-ready, blocked/question, and final
   verification states
6. an ADR or doc update when the issue introduces a durable product,
   architecture, workflow, or safety rule

### Priority policy

Issue selection should follow an explicit queue discipline:

1. active-priority issue over backlog-later issue
2. milestone-linked issue over non-milestone issue
3. oldest issue within the same priority band
4. backlog-later issues only when no active-priority issue is available or when
   the user explicitly chooses one

The exact label vocabulary may evolve, but the repository should maintain a
clear distinction between active implementation candidates and deferred backlog
work.

## Kanban operating model

The recommended board lifecycle is:

```text
triage -> planning -> ready -> implementing -> review -> done
                          \-> blocked
```

Recommended card types:

- issue-level orchestrator card
- planning card
- schema/domain card
- service/backend card
- UI card
- tests/verification card
- docs/ADR/issue-record card
- final-review card

Recommended dependency pattern:

- planning card depends only on issue intake
- implementation cards depend on planning
- final-review card depends on all required implementation and verification
  cards
- docs/ADR/update card may depend on implementation findings when the durable
  decision becomes clear during execution

Kanban cards should be assigned to actual configured Hermes profiles. Profile
names must not be invented at runtime.

## Consequences

### Positive

- makes issue execution durable and inspectable
- matches Ruletrade-AI’s own multi-role safety philosophy
- creates an audit trail for engineering decisions and blockers
- reduces the chance that one model silently combines planning,
  implementation, and approval judgment
- supports parallelism without abandoning dependency control

### Negative

- increases orchestration overhead for small issues
- requires profile management and provider/model pinning discipline
- can create noisy status traffic if Discord reporting is not standardized
- introduces board maintenance responsibilities

## Rejected alternatives

### 1. Single generalist agent session per issue

Rejected because it makes planning, implementation, review, and decision-making
insufficiently separable and less durable.

### 2. `delegate_task` as the only orchestration mechanism

Rejected as the primary approach because delegated tasks are synchronous,
non-durable, and cancelled if the parent session is interrupted.

### 3. Free-form manual task tracking without board state

Rejected because the desired workflow explicitly needs assignment,
dependencies, blocker handling, and issue-level records.

## Implementation notes

Recommended Hermes profile families:

- `rt-orchestrator-kimi26`
- `rt-planner-kimi26`
- `rt-implementer-kimi26`
- `rt-finalcheck-gpt55low`
- `rt-worker-copilot-gpt54mini`
- `rt-worker-opencode-kimi26`
- `rt-worker-opencode-deepseek-v4flash`
- `rt-worker-deepseek-v4pro`

Recommended next implementation steps:

1. define the canonical issue-selection labels and queue policy
2. define the Discord destination and message templates
3. add `docs/issues/` conventions for per-issue execution records
4. create Hermes profiles for each leader/worker role
5. initialize and test the Kanban board workflow
6. pilot the workflow on one issue and refine based on operational findings

## Relationship to other docs

- `docs/product-principles.md` defines the safety and trust posture that this
  workflow must preserve.
- `docs/architecture.md` defines the product/runtime provider boundary and audit
  requirements.
- `docs/ai-agent-guidelines.md` defines the product-side AI role separation.
- `docs/ai-agent-organization.md` defines the product-side conceptual agent
  split that this engineering workflow intentionally mirrors.
