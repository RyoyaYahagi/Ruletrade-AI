# AI Agent Guidelines

These guidelines define how AI agents should behave inside Ruletrade-AI. They
are implementation-facing rules for prompts, schemas, services, tests, and UI
workflows. Product principles explain what the experience should feel like;
these guidelines explain how AI work should be constrained.

## Operating Model

AI work must move through explicit roles:

```text
User intent and memory
  -> Orchestrator
  -> Rule Generator
  -> Risk Reviewer
  -> Backtest Evaluator
  -> Explanation Writer
  -> Human approval
```

Agents may run in sequence or be implemented as service calls, but their
responsibilities should remain separate. Do not collapse generation, critique,
evidence, explanation, and approval into one unreviewable response.

## Shared Inputs

Every AI step should receive only the inputs it needs for its role. Common
inputs include:

- user intent
- selected market and timeframe
- user investment memory
- current structured rule draft
- prior warnings and blocker state
- available evidence
- product safety constraints

Do not rely on chat history as the only state carrier. Important state must be
represented in structured fields.

## Shared Output Rules

AI outputs should be:

- structured before they are persuasive
- explicit about assumptions
- explicit about missing information
- traceable to the rule version they affect
- safe to validate with deterministic code

AI outputs should not:

- include hidden approval decisions
- invent evidence
- overwrite blocker warnings with softer language
- change rule status without workflow logic
- treat a generated explanation as the source of truth
- directly call provider SDKs from browser code

## Orchestrator

The Orchestrator owns workflow state. It decides which role should act next, not
whether a rule is financially good for a specific person.

Responsibilities:

- collect user intent and investment memory
- decide whether the next step is generation, review, evaluation, revision, or
  approval
- preserve current rule status
- track required user actions
- prevent approval when blockers remain

Required outputs:

- next role
- reason for routing
- current status
- required user action, if any

Must not:

- approve rules
- remove warnings without reviewer or validator evidence
- turn incomplete drafts into active rules

## Rule Generator

The Rule Generator creates or revises structured drafts. It should produce a
rule that can be reviewed, not a final recommendation.

Responsibilities:

- create entry conditions
- create exit conditions
- create risk limits
- record assumptions
- respect user memory and standing constraints
- mark unresolved information clearly

Required outputs:

- title
- market
- timeframe
- risk level
- entry conditions
- exit conditions
- risk limits
- assumptions
- initial status, usually `draft` or `in_review`

Must not:

- imply that the rule is suitable for the user
- claim backtest results it did not receive
- skip exits or risk limits to produce a cleaner answer
- write only a prose strategy when structured fields are required

## Risk Reviewer

The Risk Reviewer critiques the structured rule. Its job is to find quiet
failures before the user approves anything.

Responsibilities:

- detect missing exits
- detect missing position sizing or maximum-loss constraints
- detect contradictory entry and exit logic
- flag vague conditions that cannot be evaluated
- flag possible future data leakage
- flag overfitting risk
- compare generated explanations against structured rule logic

Required outputs:

- warnings with severity `info`, `warning`, or `blocker`
- warning owner
- concrete reason
- suggested resolution when possible

Blocker examples:

- no exit condition
- no risk limit
- no evidence for a rule that requires approval
- rule uses future information
- explanation contradicts structured rule logic
- rule is marked approved while required review is missing

Must not:

- soften blocker language to reassure users
- remove warnings because the rule sounds plausible
- approve a rule after critique

## Backtest Evaluator

The Backtest Evaluator records evidence. It should distinguish measured results
from missing or unavailable evidence.

Responsibilities:

- record backtest window
- record sample size
- record drawdown or loss metrics when available
- record confidence as `unverified`, `low`, `medium`, or `high`
- record known limitations
- flag insufficient evidence

Required outputs:

- backtest window
- sample size
- expected or observed max drawdown when available
- confidence
- evidence warnings or blockers

Must not:

- fabricate backtest results
- convert anecdotal evidence into measured evidence
- hide short evaluation windows
- treat a successful test as a guarantee of future performance

## Explanation Writer

The Explanation Writer turns structured rule data into user-facing text for
review. It should help users decide what to do next without changing the rule.

Responsibilities:

- summarize the structured rule
- explain warnings and blockers in plain language
- distinguish facts, assumptions, and missing evidence
- preserve uncertainty
- prepare approval, rejection, or revision context

Required outputs:

- concise summary
- key risks
- evidence summary
- unresolved blockers
- next recommended product action, such as revise, evaluate, approve, or reject

Must not:

- add new rule logic outside the structured data
- turn warnings into reassuring copy
- make financial recommendations
- imply approval when status is blocked or in review

## Approval Boundary

Human approval is a system boundary.

AI may recommend a next workflow action, but only the product workflow and user
action may change a rule to `approved` or `rejected`.

Approval must be blocked when:

- any blocker warning remains
- required evidence is missing
- the rule has no exit condition
- the rule has no risk limit
- the explanation does not match the structured rule
- the structured rule changed after the last review

When approval happens, preserve the reviewed rule version, warnings, evidence,
explanation, actor, and timestamp when available.

## Prompt Construction

Prompts should be role-specific. Include the role, task, structured inputs,
allowed output shape, and safety constraints.

Prompt requirements:

- identify the agent role
- provide the current structured rule when one exists
- provide relevant investment memory
- state that AI output is not financial advice
- request structured output
- require assumptions and missing information to be explicit
- require blocker conditions to be preserved

Avoid prompts that ask for:

- the best trade
- guaranteed profitable rules
- personal financial advice
- a final answer without review
- hidden reasoning as the only validation path

## Provider and Runtime Boundary

AI provider calls belong behind server-side routes or Server Actions,
Edge Functions, or a provider gateway.

Client components must not:

- import provider SDKs
- read secret provider keys
- call Codex SDK/API experiments
- call OpenAI, Anthropic, or Gemini directly with secret credentials

Development-only Codex SDK/API experiments and local Codex CLI/app tasks may be
used for repository analysis, implementation planning, tests, fixtures, and
debugging. They must not become production user-facing AI execution.

## Validation Checklist

Before accepting AI output into product state, deterministic code should check:

- output matches the expected schema
- status transition is allowed
- blocker warnings are preserved
- required fields are present
- entry and exit conditions are non-empty when needed
- risk limits are non-empty when needed
- evidence fields are honest about missing data
- explanation does not introduce rule logic absent from structured data
- provider output did not request unsafe client-side secret usage

Failed validation should create warnings, block approval, or request revision.
It should not be silently ignored.

## Memory Guidelines

Investment memory should improve consistency while preserving safety.

Store:

- risk tolerance
- preferred markets
- time horizons
- rejected patterns
- standing constraints

Use memory to:

- avoid repeated rejected patterns
- highlight conflicts with user constraints
- improve draft relevance
- make review criteria more consistent

Do not use memory to:

- infer suitability beyond explicit user preferences
- bypass validation or approval
- suppress warnings
- make hidden changes to risk tolerance

## Logging and Auditability

For AI-assisted rule changes, keep enough information to reconstruct:

- input rule version
- agent role
- output fields changed
- warnings added, removed, or changed
- evidence attached
- explanation shown to the user
- validation result
- user approval or rejection action

Avoid storing provider secrets, unnecessary raw personal data, or long chat
transcripts when structured audit records are enough.

## Testing Targets

AI-agent behavior should be tested through deterministic boundaries first.

Prioritize tests for:

- schema validation of generated rule drafts
- missing exit and missing risk-limit blockers
- blocked approval while blocker warnings remain
- status transition rules
- explanation/structured-rule mismatch detection
- provider gateway request validation
- memory conflict detection
- audit record creation

Use evaluation fixtures for AI output quality only after schemas and validators
exist.

## Relationship to Other Docs

- `docs/product-principles.md` defines the product behavior and trust model.
- `docs/architecture.md` defines system structure and boundaries.
- `docs/ai-agent-organization.md` defines the high-level agent organization.
- `AGENTS.md` tells coding agents which local rules to preserve while changing
  the repository.
