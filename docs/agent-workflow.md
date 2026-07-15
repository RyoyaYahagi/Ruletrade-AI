# Agent Orchestration Workflow

## Agent Roles

| Role | Responsibility | Default Task Type |
|------|---------------|-------------------|
| `orchestrator` | Routes work between agents | `rule_orchestration` |
| `generator` | Drafts structured trading rules | `rule_draft_generation` |
| `risk_reviewer` | Validates rules for safety | `rule_review` |
| `evaluator` | Runs backtests | `eval_judge` |
| `explanation_writer` | Generates natural language | `rule_explanation` |

## Workflow Steps

1. Orchestrator creates workflow and routes to Generator
2. Generator produces structured rule draft
3. Risk Reviewer validates and flags blockers
4. Evaluator runs backtest (if rule passes review)
5. Explanation Writer generates user-facing summary
6. Orchestrator completes workflow or blocks on failures

## Model Routing

Cost-aware routing per agent role:

- Orchestrator → `balanced` (cheap model OK)
- Generator → `balanced` or `high_quality`
- Risk Reviewer → `high_quality` (safety critical)
- Evaluator → `balanced`
- Explanation Writer → `balanced`

## Persistence

Each workflow and step is persisted:

- `agent_workflows` — overall state per rule
- `agent_workflow_steps` — individual agent outputs

## Visibility

Failed or blocked steps are visible to users, not silently swallowed.

## Audit

- `model_used` — which model ran the step
- `cost_estimate` — estimated cost of the step
- `input_data` / `output_data` — structured I/O
- `error_message` — failure details
