# Rule Generation Workbench

## Overview

The workbench supports the user as the final decision maker while AI agents draft and organize rule proposals.

## Workflow

1. **Input** — User submits a strategy brief
2. **Generating** — AI orchestrator processes the brief
3. **Review** — Structured rule is displayed with sections:
   - Entry conditions
   - Exit conditions
   - Risk limits
   - Assumptions
   - Evidence
   - Warnings
4. **Edit** — User can modify the structured rule
5. **Approval** — Explicit approval boundary before activation

## Agent Workflow

```
Orchestrator → Generator → Reviewer → Evaluator → Explanation Writer
```

## UI Sections

| Section | Content |
|---------|---------|
| User Intent | Original strategy brief |
| Generated Rule | Structured data from agents |
| Review Warnings | Risk review output |
| Evidence | Supporting data |
| Unresolved Items | Blockers requiring attention |
| Approval Boundary | Final user confirmation |

## Future Work

- Connect to actual AI orchestrator endpoint
- Real-time agent status updates
- Inline editing of structured fields
- Side-by-side comparison of versions
