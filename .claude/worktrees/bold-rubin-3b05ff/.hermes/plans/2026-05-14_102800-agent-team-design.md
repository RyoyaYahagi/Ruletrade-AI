# Ruletrade-AI agent team design and workflow plan

## Goal

Design an issue-driven multi-agent implementation workflow for Ruletrade-AI that:

- selects the next GitHub issue to work on
- creates and saves a plan before implementation
- splits work by task across separate agents
- records implementation results per issue
- updates ADRs/docs when durable decisions are made
- reports progress, blockers, and clarification needs to Discord
- uses designated leader models per phase
- reserves a final verification pass for GPT-5.5 low

This plan is for workflow design only. It does not implement the automation yet.

## Context and constraints

### Product and architecture constraints

From local docs:

- Ruletrade-AI is a safety-sensitive investment-rule review product.
- AI generation, review, evidence, explanation, and approval must stay separate.
- Structured rule data remains the source of truth.
- Durable workflow rules should be captured in docs/tests/code, not only in issue text.
- User-facing wording must avoid certainty or financial-advice framing.

### Hermes/tooling constraints

- The current Hermes session can delegate subagents, but direct per-subagent model selection is limited in `delegate_task`.
- Exact model routing by phase is better implemented with Hermes profiles, Kanban workers, or spawned Hermes subprocesses.
- Discord reporting requires a configured delivery target/channel/thread.
- The repo currently has issue metadata accessible, but issue-priority policy still needs to be defined explicitly.
- `docs/adr/` does not appear to exist yet, so ADR support likely needs to be added as part of workflow implementation.

## Proposed operating model

### Leadership model assignment

1. Global orchestrator
   - Model: GPT-5.4 medium
   - Role: decide next issue, break issue into tasks, decide routing, enforce gates, collect outputs, request escalation when needed

2. Planning lead
   - Model: Kimi K2.6
   - Role: create issue plan in plan mode and save under `.hermes/plans/`

3. Implementation lead
   - Model: Kimi K2.6
   - Role: supervise task implementers, integrate results, ensure issue scope is respected

4. Final verification lead
   - Model: GPT-5.5 low
   - Role: run final code review, regression-oriented validation, and release-readiness judgment for the issue

5. Escalation design reviewer
   - Model: GPT-5.5 low by default for difficult design questions raised during execution
   - Note: user previously mentioned Sonnet/Opus in an alternate setup, but the later instruction supersedes that and uses GPT-5.4 medium + GPT-5.5 low

6. Utility workers
   - GPT-5.4 mini via GitHub Copilot provider when light, bounded coding/review tasks are sufficient
   - DeepSeek v4 Pro or similar for medium-weight independent analysis/fix tasks
   - Model chosen based on task complexity, file overlap risk, and need for careful reasoning

### Why this shape fits the product

- It mirrors the product’s own multi-role AI structure.
- It prevents a single model from silently combining planning, coding, review, and approval.
- It makes issue-level evidence and audit output explicit.

## Durable workflow design

### Phase 0: issue intake

Orchestrator responsibilities:

1. Read open GitHub issues.
2. Select the next issue using an explicit priority rule.
3. Load local docs relevant to the issue scope.
4. Open or create an issue execution record.
5. Post a Discord “starting issue” message.

Recommended priority rule:

1. explicitly prioritized/non-backlog issue
2. issue linked to current milestone
3. oldest open issue among same priority band
4. avoid issues labeled `Backlog Later` unless no active-priority issue remains

Open question for implementation:
- define a canonical label set such as `priority:high|medium|low`, `blocked`, `needs-product-decision`, `ready`

### Phase 1: planning gate

Planning lead (Kimi K2.6):

1. Read the selected issue.
2. Read relevant repo docs and code.
3. Produce a plan-only markdown file under `.hermes/plans/YYYY-MM-DD_HHMMSS-issue-<n>-<slug>.md`.
4. Include:
   - issue summary
   - assumptions
   - proposed implementation slices
   - file paths likely to change
   - required tests
   - doc/ADR impact
   - open questions
   - Discord reporting checkpoints

Gate:
- No implementation begins until a saved plan exists.

Artifacts:
- plan markdown file
- optional issue comment: “plan created”
- Discord report with plan path and unresolved questions

### Phase 2: task decomposition

Orchestrator + implementation lead:

1. Convert the plan into task-sized units.
2. Separate tasks by file-overlap risk.
3. Assign each task to a dedicated worker agent.
4. Use serial execution when tasks touch the same files.
5. Use parallel execution only for independent tasks.

Suggested task classes:

- docs/spec alignment
- schema/domain changes
- service/backend changes
- UI changes
- tests/fixtures
- issue record + ADR updates

### Phase 3: implementation

Implementation lead (Kimi K2.6) supervises workers.

Per task:

1. create or claim a task record
2. provide narrow context to the assigned worker
3. implement with local validation
4. return changed files, rationale, and unresolved concerns
5. if blocked, immediately emit a Discord blocker report

Worker selection policy:

- small refactor or test task -> GPT-5.4 mini via GitHub Copilot provider
- moderate feature task -> DeepSeek v4 Pro or similar
- sensitive workflow/domain logic -> Kimi K2.6-supervised worker or stronger reviewer involvement

Blocking policy:

If any task cannot proceed because of missing product decisions, broken environment, conflicting issue requirements, or unexpected architecture ambiguity:

- stop advancing that task
- send Discord blocker report
- mark issue/task record as blocked
- include concrete unblock request

### Phase 4: review gates

Mandatory gates after implementation and before completion.

1. Spec compliance review
   - verify the result actually satisfies issue scope and does not drift

2. Safety/architecture review
   - verify structured-data, approval-boundary, and provider-boundary rules are preserved

3. Final verification review
   - leader model: GPT-5.5 low
   - responsibilities:
     - run final review of code and docs
     - inspect test/lint/type/build results
     - identify regression and integration risk
     - explicitly approve or request fixes

No issue is marked done until GPT-5.5 low signs off on the final gate.

### Phase 5: verification

Minimum validation target per issue unless clearly inapplicable:

- `npm run lint`
- `npm run typecheck`
- `npm run build`

When issue scope warrants it:

- targeted tests
- local app run and screen inspection
- Playwright or equivalent UI verification for important workflows/responsive states

### Phase 6: records and reporting

Per issue, produce all of the following:

1. Plan file
2. Issue execution record
3. ADR or docs update when a durable product/architecture decision was made
4. GitHub issue comment summarizing:
   - what was implemented
   - what was intentionally deferred
   - test/build status
   - follow-up questions or risks
5. Discord status messages:
   - started
   - plan ready
   - blocked/question raised
   - implementation completed
   - final verification result

## Proposed artifacts

### 1. Issue execution record

Recommended path pattern:

- `docs/issues/<issue-number>.md`

Suggested sections:

- issue title and URL
- status
- selected priority rationale
- plan path
- task breakdown
- files changed
- tests run and results
- blockers/questions encountered
- follow-up work
- final reviewer verdict

### 2. ADRs

Recommended path pattern:

- `docs/adr/NNNN-short-title.md`

Create/update ADR when:

- a durable workflow decision is made
- model-routing policy changes
- issue-selection policy becomes canonical
- Discord reporting and recordkeeping are standardized
- task/agent orchestration mechanism is chosen

### 3. Discord message templates

Start:
- `Starting issue #<n> <title>. Plan phase assigned to Kimi K2.6. Orchestrator: GPT-5.4 medium.`

Plan ready:
- `Plan saved for issue #<n>: <path>. Open questions: ...`

Blocker:
- `Blocked on issue #<n>, task <name>. Cause: ... Need decision/input on: ...`

Done pending final review:
- `Implementation complete for issue #<n>. Running final GPT-5.5 low verification.`

Final result:
- `Issue #<n> verified. Checks: lint/typecheck/build = ... Follow-ups: ...`

## Recommended Hermes implementation architecture

Because exact model-by-phase routing is required, prefer durable Hermes constructs over plain `delegate_task` alone.

### Option A: Hermes profiles + spawned Hermes processes

Use one profile per leader/worker class:

- `rt-orchestrator-gpt54m`
- `rt-planner-kimi26`
- `rt-implementer-kimi26`
- `rt-finalcheck-gpt55low`
- `rt-worker-copilot-gpt54mini`
- `rt-worker-deepseek-v4pro`

Pros:
- direct provider/model pinning per profile
- easy to reason about phase ownership

Cons:
- more process orchestration overhead
- more logging/report plumbing needed

### Option B: Hermes Kanban board + assigned worker profiles

Recommended default for durability.

Board lanes/state ideas:

- triage
- planning
- ready-for-implementation
- implementing
- review
- blocked
- done

Task assignment:

- orchestrator profile creates/assigns issue-level and task-level cards
- planner profile handles planning cards
- implementation workers handle coding cards
- finalcheck profile handles review cards

Pros:
- durable queue and status history
- clearer multi-agent separation
- natural fit for blocker handling and Discord notifications

Cons:
- requires initial board setup and conventions

Recommendation:
- use Kanban as the durable control plane
- use profile-pinned Hermes workers as execution agents

## Proposed execution policy for Ruletrade-AI

1. Choose one issue at a time at the issue level.
2. Allow subtask parallelism only within that issue when file overlap is low.
3. Keep planning and implementation separate, even when the same model family leads both.
4. Require final GPT-5.5 low verification on every issue.
5. Require Discord reporting for any blocker or ambiguity that can stop progress.
6. Require local docs/ADR update when workflow rules become durable.
7. Treat issue text as input, not as the only source of policy.

## Files likely to be added/changed when implementing this workflow

Hermes/repo workflow side:

- `docs/ai-agent-organization.md`
- `docs/ai-agent-guidelines.md`
- `README.md`
- `docs/adr/` (new directory)
- `docs/issues/` (new directory)
- `.hermes/plans/` (already used for plans)

Potential helper scripts/config if automation is added:

- repo-local orchestration script(s)
- Hermes profile configuration docs
- Kanban workflow docs
- Discord reporting helper config/docs

## Risks and tradeoffs

1. Over-orchestration risk
   - Too many agents can slow simple issues.
   - Mitigation: allow task-count thresholds before parallelism.

2. Model-routing complexity
   - Exact provider/model pinning is harder with lightweight delegation alone.
   - Mitigation: use profiles and Kanban workers.

3. Discord noise
   - Too many status messages can reduce signal.
   - Mitigation: standardize only key transitions and blockers.

4. File-conflict risk across workers
   - Parallel coding on overlapping files can cause churn.
   - Mitigation: serialize by file ownership.

5. False sense of completion
   - Passing build is not enough for safety-sensitive product behavior.
   - Mitigation: preserve safety/architecture review gate and final GPT-5.5 low review.

## Open questions to resolve before automation

1. What exact rule defines “next issue” in this repo?
2. Which Discord channel/thread should receive reports?
3. Should issue records live in `docs/issues/` or another path?
4. Should ADR numbering be sequential from `0001`?
5. Should the orchestrator auto-comment on GitHub issues, or only after final verification?
6. Which Hermes mechanism is preferred for execution: profiles only, Kanban, or profiles + Kanban?
7. Which exact provider/model IDs correspond to:
   - GPT-5.4 medium
   - GPT-5.5 low
   - Kimi K2.6
   - DeepSeek v4 Pro
   - GitHub Copilot GPT-5.4 mini route

## Recommended next step

Implement the workflow foundation in this order:

1. define issue-selection policy
2. define Discord destination and message policy
3. add `docs/adr/` and `docs/issues/` conventions
4. create Hermes profile map for each leader/worker role
5. choose Kanban as durable orchestrator layer
6. pilot the workflow on one non-backlog issue
7. refine based on pilot findings and capture them in an ADR
