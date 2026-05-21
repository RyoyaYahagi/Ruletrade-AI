# AI Agent Organization Design

Ruletrade-AI treats AI as a reviewable organization, not as one all-purpose
assistant. The product should separate generation, critique, evaluation, and
approval so investment rules remain inspectable before a user adopts them.

## Product Principles

1. **AI assists; users decide.**
   - AI may draft, review, and flag, but users approve, reject, or revise every rule.
   - No AI output is treated as a final recommendation or investment advice.

2. Split rule generation from rule review.
   - A generator drafts the strategy.
   - A risk reviewer checks contradictions, missing exits, position sizing, and
     overfitting risk.
   - A backtest evaluator records measurable evidence before approval.

3. Store rules as structured data.
   - Keep entry, exit, risk limits, assumptions, evidence, warnings, and status
     as separate fields.
   - Natural-language explanations should be derived from the structured rule,
     not used as the source of truth.

4. Make human approval explicit.
   - AI may draft, review, and flag.
   - Users approve, reject, or request revision before a rule becomes active.
   - Product states should include draft, in review, blocked, approved, and
     rejected.

5. Build shared memory for user investment philosophy.
   - Store risk tolerance, preferred markets, time horizon, rejected patterns,
     and recurring constraints.
   - Feed that memory into future generation and review steps.

6. Monitor quiet failures.
   - Check for internally inconsistent rules, future data leakage, missing stop
     conditions, short evaluation windows, and mismatches between explanation
     and executable logic.
   - Surface blockers as review tasks rather than silently accepting them.

## Suggested Agent Responsibilities

- Orchestrator: routes work and tracks status.
- Rule Generator: creates a first structured draft.
- Risk Reviewer: rejects unsafe or underspecified logic.
- Backtest Evaluator: records evidence, sample size, and failure cases.
- Explanation Writer: turns the final structured rule into user-facing text.

## GitHub Issue Split

Use GitHub issues for implementation slices that need discussion or tracking:

- Add structured trading rule schema and persistence.
- Build rule generation workbench.
- Add risk review checks and warning taxonomy.
- Add backtest evaluation workflow.
- Add approval states and audit trail.
- Add user investment memory.
