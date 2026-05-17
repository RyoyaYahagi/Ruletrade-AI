# Ruletrade-AI Product Principles

Ruletrade-AI helps users turn investment ideas into reviewable trading rules.
The product should make users more deliberate, not more impulsive. AI should
accelerate drafting and critique while keeping risk, uncertainty, and approval
visible.

## Product Promise

Ruletrade-AI is a workspace for creating, reviewing, and improving investment
rules with AI. It is not an autopilot, signal seller, or financial adviser.

The product succeeds when users can clearly answer:

- What rule is being proposed?
- Why does the rule exist?
- What conditions trigger entry and exit?
- What can go wrong?
- What evidence supports or weakens the rule?
- What still needs human judgment before adoption?

## Core Experience Principles

1. Make the rule inspectable.
   Users should be able to see the structure of a rule without reading a long
   chat transcript. Entry, exit, risk, assumptions, evidence, warnings, and
   approval state should be visible as separate concepts.

2. Slow down risky decisions.
   The product should add friction before approval when evidence is missing,
   risk limits are unclear, or the rule is internally inconsistent.

3. Show uncertainty plainly.
   Unverified, low-confidence, or blocked states should be obvious. Do not hide
   uncertainty behind polished AI summaries.

4. Make critique feel normal.
   Warnings and blockers are part of the workflow, not failures. The interface
   should make revision feel expected and productive.

5. Preserve user agency.
   AI may draft, review, evaluate, and explain. Users approve, reject, revise,
   or archive.

6. Remember the user's philosophy.
   Risk tolerance, preferred markets, time horizons, rejected patterns, and
   standing constraints should inform future drafts and reviews.

7. Prefer evidence over confidence theater.
   Use concrete evidence such as backtest window, sample size, drawdown, and
   known limitations instead of vague claims of intelligence or certainty.

## Safety Principles

- Never imply guaranteed profit, guaranteed risk reduction, or suitability for a
  specific user's financial situation.
- Do not present AI output as financial advice.
- Do not allow a rule to appear approved when required review or evidence is
  missing.
- Do not bury blocker-level warnings in secondary UI.
- Do not let natural-language explanations override structured rule logic.
- Do not silently convert a rejected or blocked rule into an active rule.
- Require a new review when the structured rule changes after approval.

## User Mental Model

Users should understand the product as a review bench:

```text
Idea
  -> Structured draft
  -> AI risk review
  -> Evidence and backtest review
  -> Human approval decision
  -> Saved rule version
```

The product should avoid the mental model of:

```text
Prompt
  -> AI answer
  -> Immediate trade decision
```

## AI Behavior Principles

AI assistants inside Ruletrade-AI should:

- ask for missing constraints when the rule is underspecified
- separate assumptions from facts
- identify missing exits and risk limits
- flag possible future data leakage
- call out short or weak evaluation windows
- explain blockers in concrete terms
- produce structured output that can be validated
- preserve the difference between draft, review, evidence, and approval

AI assistants should not:

- make personal financial recommendations
- invent backtest evidence
- hide uncertainty to sound more helpful
- rewrite warnings as reassuring language
- treat user approval as implicit
- use chat history as the only source of rule state

## UI Principles

The interface should feel like a focused operational tool. Prioritize scanning,
comparison, and repeated review over delight for its own sake.

Design defaults:

- Put the current rule status near the rule title.
- Show blocker warnings before approval actions.
- Keep approval and rejection actions explicit.
- Use compact evidence panels for backtest window, sample size, drawdown, and
  confidence.
- Separate generated explanations from the structured rule.
- Make shared investment memory visible when it influences a draft.
- Use calm, precise copy. Avoid hype and certainty.

Avoid:

- marketing-style hero pages for core workflows
- chat-only rule state
- one large unstructured AI answer as the primary artifact
- hiding validation failures behind expandable details
- celebratory visuals for unverified results
- copy that frames blocked states as errors

## Trust and Transparency

Every important product action should leave enough context for a later user,
developer, or reviewer to understand what happened.

For rule decisions, preserve:

- the structured rule version
- warnings and blocker state
- evidence available at the time
- generated explanation shown to the user
- approval, rejection, or revision action
- timestamp and actor when authentication exists

Users should be able to distinguish:

- user-provided preferences
- AI-generated drafts
- AI-generated critique
- measured evidence
- human decisions

## Personalization Principles

Shared investment memory should make the product more consistent, not more
reckless.

Use memory to:

- avoid repeatedly suggesting rejected patterns
- keep recurring risk constraints visible
- tailor rule drafts to preferred markets and time horizons
- remind users when a new rule conflicts with their stated philosophy

Do not use memory to:

- infer financial suitability beyond what the user explicitly provides
- bypass review steps
- personalize away safety warnings
- make hidden changes to approval criteria

## Success Criteria

Ruletrade-AI is improving when:

- more rules are represented as structured data
- fewer rules lack exits, risk limits, or evidence
- blocker states are resolved through concrete revisions
- users can compare rule versions and evidence clearly
- approved rules have an audit trail
- AI-generated text stays consistent with executable logic
- repeated user constraints influence future drafts and reviews

Ruletrade-AI is drifting when:

- chat output becomes the source of truth
- approval becomes a single optimistic click
- warnings are softened or hidden
- evidence is summarized without preserving details
- provider integration leaks into browser code
- the product optimizes for more rules instead of better-reviewed rules

## Relationship to Other Docs

- `docs/architecture.md` explains how the system should be structured.
- `docs/ai-agent-organization.md` explains how AI responsibilities are split.
- `docs/frontend-design-reference.md` explains how to use the local
  `frontend-design/` mockups when implementing investment-facing UI.
- `AGENTS.md` explains what coding agents must read and preserve while working.
- ADRs in `docs/adr/` should record durable product or architecture decisions
  when the team chooses one path over another.
