<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Ruletrade-AI Agent Instructions

Ruletrade-AI is an application for creating and reviewing investment rules with
AI. Treat the product as a safety-sensitive decision-support tool: AI may draft,
review, explain, and evaluate rules, but users must remain in control of
approval and activation.

## Before Editing

- Read the relevant local docs before changing behavior:
  - `README.md` for setup, secrets, provider boundaries, and project structure.
  - `docs/product-principles.md` for the product promise, safety posture, UI
    principles, trust model, and product success criteria.
  - `docs/architecture.md` for system boundaries, domain model, service layers,
    provider gateway, approval workflow, and audit expectations.
  - `docs/ai-agent-guidelines.md` for AI role behavior, prompt construction,
    validation checklist, provider/runtime boundary, memory rules, and testing
    targets.
  - `docs/ai-agent-organization.md` for the high-level multi-agent
    organization model.
  - `docs/frontend-design-reference.md` before implementing or changing
    investment-facing frontend screens; use the local `frontend-design/`
    mockups as the UI reference.
  - The relevant file under `node_modules/next/dist/docs/` before using or
    changing Next.js APIs, routing, rendering, metadata, server actions, or
    config.
- If a task touches trading rules, AI outputs, approval, validation, warnings,
  investment memory, provider calls, or investment-facing UI, read the relevant
  docs above before editing code.
- Prefer local documentation and code patterns over assumptions from memory.
- Use GitHub issues for task context, but do not treat issue text as the only
  source of durable rules. If a rule should affect future work, update local
  docs or tests as part of the change.

## Product Guardrails

- Keep rule generation separate from review, evaluation, and approval.
- Store investment rules as structured data. Natural-language explanations are
  derived from structured rules, not the source of truth.
- Preserve explicit user approval states such as draft, in review, blocked,
  approved, and rejected.
- Surface missing exits, missing position sizing, future data leakage, short
  evaluation windows, contradictory logic, and explanation/execution mismatches
  as blockers or warnings.
- Do not present AI output as financial advice or as a guaranteed result.
- Avoid silently accepting unsafe or underspecified rules. Add validation,
  warning states, or review tasks when behavior is ambiguous.

## Architecture Expectations

- Keep domain logic out of UI components when practical.
- Put shared domain schemas in `src/schemas/`.
- Put shared types in `src/types/`.
- Put feature-specific UI and behavior in `src/features/<feature>/`.
- Keep reusable UI primitives in `src/components/ui/`.
- Server-only modules that read secrets or privileged credentials must include
  `import "server-only";`.
- Browser code must never call OpenAI, Anthropic, Gemini, Stripe secret APIs, or
  Supabase service-role APIs directly. Use server routes, Server Actions, Edge
  Functions, or a server-side provider gateway.

## Next.js 16 Rules

- This project uses Next.js `16.2.6`; do not rely on older Next.js conventions
  without checking the bundled docs.
- Before changing App Router behavior, read the relevant docs in
  `node_modules/next/dist/docs/01-app/`.
- Before changing config, compiler, accessibility, or runtime behavior, read the
  relevant docs in `node_modules/next/dist/docs/03-architecture/`.
- Heed deprecation notices from the local docs and from command output.

## Implementation Style

- Match the existing TypeScript, React, Tailwind, and shadcn-style component
  patterns.
- Keep changes scoped to the task. Do not refactor unrelated files just because
  they are nearby.
- Prefer typed schemas and explicit validation over ad hoc string parsing for
  trading rules, AI output, and persisted domain data.
- Use lucide-react icons for icon buttons when an icon exists.
- Keep UI copy sober and precise. Avoid implying investment certainty.
- Do not add client-visible feature instructions or implementation notes as UI
  filler.
- For investment-facing frontend work, compare against the relevant
  `frontend-design/` mockup and preserve the review-bench structure: structured
  draft, review warnings, evidence, unresolved items, and explicit approval
  boundary.

## Verification

Run the smallest useful set of checks for the change:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
```

For UI changes, run the app and inspect the affected screen. Use Playwright when
the change affects responsive layout, important workflows, or visual state.

## CI Rules

These rules are non-negotiable. Follow them exactly.

### What AI must never do

- Disable, delete, or weaken any CI job or check.
- Skip, delete, or add `.skip`/`xit` to tests to make CI pass.
- Loosen lint rules, typecheck settings, or format config to silence failures.
- Remove or soften secret-scan rules to hide detected values.

If a test or check is genuinely broken beyond the scope of the current change,
keep it failing, explain why in the PR description, and ask a human to decide.

### CI jobs (`.github/workflows/ci.yml`)

All jobs run on every PR targeting `main`. Required jobs:

| Job             | Command                                                       |
| --------------- | ------------------------------------------------------------- |
| Format Check    | `npm run format:check`                                        |
| Lint            | `npm run lint`                                                |
| Type Check      | `npm run typecheck`                                           |
| Unit Tests      | `npm run test`                                                |
| Build           | `npm run build`                                               |
| Secret Scan     | Gitleaks CLI                                                  |
| Migration Check | psql apply — **only when `supabase/migrations/**` changes\*\* |

### When CI fails

1. Read the full failure log.
2. Identify the root cause (do not guess).
3. Fix the underlying code with the minimum change needed.
4. Never work around the failure by weakening the check.

### Permissions

All jobs run with `permissions: contents: read`. Grant write permissions only
to specific jobs that provably require them, and document why.

### Merging to main

Only humans merge to `main`. AI must not push directly to `main` or bypass
branch protection.

## Documentation Maintenance

- If a GitHub issue introduces a recurring product rule, architecture boundary,
  safety constraint, or workflow convention, add it to `AGENTS.md`, `README.md`,
  or `docs/`.
- If a product or architecture decision changes direction, add or update an ADR
  under `docs/adr/`.
- Keep docs short, operational, and close to the code they govern.
