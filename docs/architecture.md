# Ruletrade-AI Architecture

Ruletrade-AI is a decision-support application for drafting, reviewing, and
approving investment rules with AI. The architecture must make every rule
inspectable before adoption. AI output is treated as a draft or review artifact,
not as an executable truth.

## Core Principles

1. Structured rules are the source of truth.
   Natural-language explanations, summaries, and UI labels must be generated
   from structured rule data whenever possible.

2. Generation, review, evaluation, and approval are separate responsibilities.
   A rule should move through explicit states instead of becoming active
   directly from an AI response.

3. Evidence must travel with the rule.
   Backtest windows, sample sizes, known limitations, drawdown estimates,
   warnings, and confidence levels should be stored beside the rule they
   support.

4. Users approve; AI assists.
   AI can propose, critique, explain, and evaluate. Final approval, rejection,
   or revision requests are user actions.

5. Safety boundaries belong in code and tests.
   Important constraints should be represented by schemas, validators, workflow
   states, tests, and docs, not only by GitHub issue text.

## Current System Shape

```text
src/
  app/
    api/
      me/
        route.ts
    auth/
      callback/
        route.ts
    dashboard/
      page.tsx
    layout.tsx
    login/
      page.tsx
    page.tsx
    signup/
      page.tsx
  components/
    ui/
  features/
    auth/
      components/
        login-form.tsx
        logout-button.tsx
        signup-form.tsx
      pages/
        login-page.tsx
        signup-page.tsx
      services/
        auth-client-service.ts
    rules/
      components/
        rule-agent-workbench.tsx
      services/
        rule-workflow.ts
        trading-rule-validation.ts
      model.ts
  lib/
    auth/
      get-current-user.ts
      require-admin.ts
      require-user.ts
    db/
      supabase-admin.ts
      supabase-browser.ts
      supabase-server.ts
      update-session.ts
    errors/
      app-error.ts
    utils.ts
  schemas/
    rules/
      trading-rule.ts
  types/

docs/
  ai-agent-organization.md
  architecture.md
  adr/
```

The current application starts with an agent workbench that demonstrates the
target workflow: user intent, shared investment memory, structured rule draft,
AI review warnings, evaluation evidence, and a human approval boundary.

## Domain Model

The central domain entity is `TradingRule` in `src/schemas/trading-rule.ts`.
It separates:

- identity and status
- market and timeframe
- risk level
- entry conditions
- exit conditions
- risk limits
- assumptions
- evaluation evidence
- review warnings
- approval requirements

Rule status should remain explicit. The expected lifecycle is:

```text
draft -> in_review -> blocked
                  \-> approved
                  \-> rejected
```

`blocked` is not an error state. It is a useful product state for rules that
need more evidence, clearer constraints, or user revision before approval.

## Agent Responsibilities

Ruletrade-AI treats AI as a reviewable organization rather than one
all-purpose assistant.

- Orchestrator: tracks the workflow, status, next owner, and required user
  actions.
- Rule Generator: creates structured rule drafts from user intent and memory.
- Risk Reviewer: detects contradictions, missing exits, missing position
  sizing, future data leakage, overfitting risk, and explanation/execution
  mismatches.
- Backtest Evaluator: records evidence, sample size, drawdown, confidence, and
  known limitations.
- Explanation Writer: turns the final structured rule into user-facing text for
  approval.

Each agent output should be stored as structured data or attached evidence
where practical. Avoid making natural-language chat history the only record of
why a rule changed.

## Application Layers

### UI Layer

Use `src/app/` for routing and page entry points. Next.js also supports a
top-level `app/` directory, but this repository intentionally uses the `src`
directory convention. Keep pages thin. Pages should compose feature modules
rather than own domain behavior.

Use `src/components/ui/` for reusable UI primitives. These components should be
generic and unaware of trading concepts.

Use `src/features/<feature>/` for feature-specific components, view models, and
client interaction logic. A feature may import schemas and shared utilities, but
shared domain rules should move out of feature components when they become
reused or safety-critical.

### Domain Layer

Use `src/schemas/` for domain schemas and validation-ready models. Trading rule
shape, warning severity, statuses, agent roles, and investment memory belong
here when they are shared across features or persistence boundaries.

Prefer explicit typed fields over free-form text blobs for AI output. Free-form
text is acceptable for user-facing explanations and notes, but not as the only
representation of executable rule logic.

### Service Layer

As workflows grow, introduce service modules for:

- rule validation
- warning generation
- approval-state transitions
- evidence normalization
- provider-gateway calls
- persistence adapters

Services that access secrets, privileged credentials, provider SDKs, or
server-only APIs must be server-only modules and include `import "server-only";`.

Feature-specific services should live with their feature first, for example
`src/features/rules/services/`. Promote code to `src/lib/` only when it becomes
shared infrastructure across features, such as auth, database clients, provider
gateways, safety checks, error handling, or configuration.

### Persistence Layer

Persist rules, evidence, warnings, approval events, and user investment memory
as separate but linkable records. Avoid overwriting history that explains why a
rule was approved, blocked, or rejected.

When Supabase is introduced, keep service-role access on the server side only.
Browser code may use public Supabase anon configuration, but must never access
service-role credentials.

### Auth Layer

Supabase clients are split by runtime:

- `src/lib/db/supabase-browser.ts` is for Client Components and uses only
  `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `src/lib/db/supabase-server.ts` is for Server Components, Server Actions, and
  Route Handlers that need the current user's cookie-backed session.
- `src/lib/db/supabase-admin.ts` is server-only and reserved for privileged
  operations that truly require `SUPABASE_SERVICE_ROLE_KEY`.

Use `src/proxy.ts` to refresh Supabase SSR sessions. Protected server routes
should use `getCurrentUser` for optional auth and `requireUser` when auth is
mandatory. Client code must never import the admin client or read service-role
credentials.

## AI Provider Boundary

Client components must not call OpenAI, Anthropic, Gemini, or any provider with
secret credentials directly.

Preferred runtime path:

```text
Browser
  -> Next.js API Route / Server Action / Supabase Edge Function
  -> AI Provider Gateway
  -> OpenAI / Anthropic / Gemini
```

The provider gateway should own:

- provider selection
- model configuration
- prompt assembly
- schema validation of model output
- usage limits
- audit logging
- safety checks
- retry and failure handling

Development-only Codex SDK/API experiments and local Codex CLI/app tasks must
stay separate from production user-facing AI execution.

## Validation and Safety

Before a rule can be approved, the system should be able to answer:

- Does the rule have entry conditions?
- Does the rule have exit conditions?
- Does the rule define position sizing or maximum loss?
- Does the rule avoid future data leakage?
- Is the backtest window recorded?
- Is the sample size recorded?
- Are warnings acknowledged or resolved?
- Does the explanation match the structured logic?

These checks should become validators and tests as implementation proceeds.
Warnings should use explicit severity levels such as `info`, `warning`, and
`blocker`.

## Human Approval and Audit Trail

Approval is a product boundary, not a button-only UI concern. Store enough
information to reconstruct:

- who approved or rejected a rule
- what structured rule version was reviewed
- what warnings existed at the time
- what evidence existed at the time
- what explanation was shown to the user
- when the decision happened

Do not let regenerated AI text silently change the meaning of an approved rule.
If the structured rule changes after approval, require a new review.

## Frontend Design Direction

The application should feel like a focused operational tool, not a marketing
landing page. Prioritize scanning, comparison, and repeated review workflows.

Use dense but calm layouts for:

- rule drafts
- warning lists
- evidence panels
- approval actions
- user memory
- agent status

Avoid implying certainty through visual treatment. Blocked, unverified, or
low-confidence rules should be visibly distinct from approved rules.

## Testing Strategy

Use the smallest useful verification for each change, then broaden coverage when
shared behavior or safety boundaries change.

Expected test areas:

- schemas: rule shape, status values, warning severities, evidence requirements
- services: validation, warning generation, state transitions, provider parsing
- api: server-only provider access, request validation, error handling
- safety: missing exits, missing risk limits, leakage flags, low sample sizes
- e2e: rule creation, review, blocked approval, final approval flow

Run these checks when relevant:

```bash
npm run lint
npm run typecheck
npm run build
```

## Documentation and ADRs

Use GitHub issues for implementation discussion and tracking. When an issue
establishes a durable rule, architecture boundary, or product safety decision,
move that decision into local documentation.

Use `docs/adr/` for decisions that change direction or introduce lasting
tradeoffs, such as:

- choosing the AI provider gateway shape
- choosing persistence boundaries
- changing the rule lifecycle
- adopting a validation library
- introducing backtest infrastructure
- deciding how user investment memory is stored

Keep architecture docs operational. They should help the next agent or developer
make a correct implementation choice quickly.
