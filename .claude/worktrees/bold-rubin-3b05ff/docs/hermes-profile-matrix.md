# Hermes Profile Matrix

This document defines the recommended profile families for the Ruletrade-AI
engineering workflow.

It is a setup reference, not a runtime policy for the product itself.

## Overview

The workflow uses role-specific Hermes profiles so planning, implementation,
review, and low-risk utility work stay separate.

Recommended model ownership:

- orchestrator: GPT-5.5 low, with Kimi K2.6 as fallback when GPT-5.5 low is constrained
- planner: Kimi K2.6
- implementer lead: Kimi K2.6
- final reviewer: GPT-5.5 low
- lightweight worker: GPT-5.4 mini via GitHub Copilot provider
- Kimi/OpenCode worker: Kimi K2.6 via OpenCode Go plan
- medium independent worker: DeepSeek v4 Pro or equivalent

## Recommended profile families

### 1. `rt-orchestrator-gpt54m`

Purpose:
- issue intake
- queue selection
- Kanban routing
- task decomposition
- blocker detection
- final completion coordination

Recommended tools:
- kanban
- file
- terminal
- session_search
- skills

Notes:
- This profile should stay focused on orchestration rather than implementation.
- It should not be used as the final review authority.
- Model intent: GPT-5.5 low.
- If GPT-5.5 low is constrained, fall back to Kimi K2.6.

### 2. `rt-planner-kimi26`

Purpose:
- produce saved plans in `.hermes/plans/`
- define task slices, file ownership, and checkpoints
- identify ADR/doc impact early

Recommended tools:
- file
- terminal
- skills

Notes:
- Keep this profile planning-only during the initial phase.
- It should not start code changes until the plan is saved.

### 3. `rt-implementer-kimi26`

Purpose:
- central implementation tasks
- sensitive workflow changes
- code that benefits from stronger context continuity

Recommended tools:
- file
- terminal
- skills

Notes:
- Route through OpenCode Go-backed execution for Kimi-based work.
- Use for tasks that are too important or broad for a quick utility worker.

### 4. `rt-finalcheck-gpt55low`

Purpose:
- final code review
- regression and integration check
- approval of issue completion

Recommended tools:
- file
- terminal
- skills

Notes:
- Must remain separate from the implementation lead.
- This profile should review the final state, not the draft plan.

### 5. `rt-worker-copilot-gpt54mini`

Purpose:
- lightweight tests
- small refactors
- bounded fixups
- short follow-up tasks

Recommended tools:
- file
- terminal
- skills

Provider rule:
- GitHub Copilot only

Notes:
- Use for narrow tasks with low file-overlap risk.
- Good for tiny test additions or mechanical edits.

### 6. `rt-worker-opencode-kimi26`

Purpose:
- Kimi-based worker tasks that should run through OpenCode Go plan
- medium-size implementation or analysis tasks requiring Kimi

Recommended tools:
- file
- terminal
- skills

Notes:
- This is the recommended bridge for the user’s Kimi/OpenCode requirement.

### 7. `rt-worker-deepseek-v4pro`

Purpose:
- independent analysis
- supporting implementation work
- secondary review or investigation

Recommended tools:
- file
- terminal
- skills

Notes:
- Use when the task is non-trivial but does not need the full Kimi lead.

## Profile design rules

1. Every profile should have one primary responsibility.
2. Avoid reusing the orchestrator for direct implementation.
3. Avoid letting the implementer act as the final reviewer.
4. Keep utility workers narrow and disposable.
5. Do not invent assignee names in Kanban unless the profile actually exists.

## Suggested minimal first roster

If you want the smallest useful setup, create these first:

- `rt-orchestrator-gpt54m`
- `rt-planner-kimi26`
- `rt-implementer-kimi26`
- `rt-finalcheck-gpt55low`

Then add these when the workflow needs parallelism:

- `rt-worker-copilot-gpt54mini`
- `rt-worker-opencode-kimi26`
- `rt-worker-deepseek-v4pro`

## Setup note

The current execution environment does not expose a `hermes` binary, so this
file is intentionally a design and setup reference rather than a verified
command transcript.
