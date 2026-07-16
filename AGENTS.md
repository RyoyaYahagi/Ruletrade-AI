# AGENTS.md

This repository is Ruletrade-AI.

Ruletrade-AI is an AI-assisted investment rule design app.

It helps users organize their own investment rules, identify missing fields, and review saved notes.

It does not provide investment advice, buy/sell recommendations, asset management, brokerage services, or order execution.

## Core principles

- Do not expose secrets to the browser.
- Do not use `NEXT_PUBLIC_` for server secrets.
- Do not call AI providers directly from Client Components.
- Do not bypass server-side ownership checks in normal user APIs.
- Do not weaken financial safety or compliance checks.
- Do not add buy/sell recommendation copy.
- Keep changes small and scoped to the issue.
- Enforce server-side ownership checks in every new API route or service
  that touches user-owned data, not only preserve existing ones.
- Before writing new logic, search for existing similar implementations and
  shared utilities; reuse or extend them instead of duplicating.

## Required checks before completing a task

Run or mention why you could not run:

```bash
npm run typecheck
npm run lint
npm run test
```

If database ownership or schema changed, add or update the corresponding SQLite
service tests.

If UI changed:

```bash
npm run test:e2e
```

## Testing rules

- When a test fails, suspect the implementation first. Change a test's
  expectations only when the intended behavior changed, and state that
  change and its reason when reporting the task.
- Do not commit `.skip` or `.only` in test files. CI rejects them via
  `npm run check:test-hygiene`.
- Every new API route or service that reads or writes user-owned data must
  ship with a test proving access with another user's ID fails.

## Architecture rules

- Next.js App Router
- TypeScript
- Local session authentication
- SQLite database
- Server-side ownership checks
- Local file storage
- AI Provider Gateway
- Mock/OpenAI/Gemini provider switching
- Safety Check before displaying AI output
- Compliance Gate before displaying financial output

## Comment rules

Write comments only for intent that cannot be derived from the code itself:

- Why this approach was chosen, especially when a simpler-looking alternative
  was deliberately rejected (so a later reader does not "simplify" it back).
- External constraints being worked around (SQLite behavior, Next.js App
  Router quirks, AI provider API limitations).
- Domain or compliance reasons (e.g. why wording avoids buy/sell
  recommendations, why the Compliance Gate runs at this point).
- Preconditions and invariants the code relies on (e.g. "caller has already
  verified ownership").

Do not write comments that restate what the code does. If a function has no
non-derivable intent, it needs no comment. For module-level "why does this
exist" context, use a short comment at the top of the file or a doc under
`docs/`.

## Fallback rules

Do not add fallbacks casually:

- When an operation fails or required data is missing, fail explicitly
  (throw or return an error) instead of silently falling back to a default
  value, an empty result, or an alternate code path. Silent fallbacks hide
  bugs and corrupt downstream state.
- Add a fallback only when it is an explicit requirement, and document at
  the fallback site why it is safe and what triggers it.
- Never use a fallback to bypass Safety Check, Compliance Gate, or
  ownership checks.

## Review

When reviewing a diff or PR, also apply the checklist in
`.agents/skills/review-checklist/SKILL.md` (symlinked from
`.claude/skills/review-checklist`).

## Forbidden

- Do not edit `.env.local`.
- Do not commit real secrets.
- Do not disable tests to pass CI.
- Do not remove ownership checks.
- Do not change production deployment settings.
- Do not make broad refactors unless explicitly requested.
