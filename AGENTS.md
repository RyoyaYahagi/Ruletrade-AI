# AGENTS.md

This repository is Ruletrade-AI.

Ruletrade-AI is an AI-assisted investment rule design app.

It helps users organize their own investment rules, identify missing fields, and review saved notes.

It does not provide investment advice, buy/sell recommendations, asset management, brokerage services, or order execution.

## Core principles

- Do not expose secrets to the browser.
- Do not use `NEXT_PUBLIC_` for server secrets.
- Do not call AI providers directly from Client Components.
- Do not bypass RLS in normal user APIs.
- Do not weaken financial safety or compliance checks.
- Do not add buy/sell recommendation copy.
- Keep changes small and scoped to the issue.

## Required checks before completing a task

Run or mention why you could not run:

```bash
npm run typecheck
npm run lint
npm run test
```

If DB/RLS changed:

```bash
supabase test db
```

If UI changed:

```bash
npm run test:e2e
```

## Architecture rules

- Next.js App Router
- TypeScript
- Supabase Auth
- Supabase Postgres
- Supabase RLS
- Supabase Storage
- AI Provider Gateway
- Mock/OpenAI/Gemini provider switching
- Safety Check before displaying AI output
- Compliance Gate before displaying financial output

## Forbidden

- Do not edit `.env.local`.
- Do not commit real secrets.
- Do not disable tests to pass CI.
- Do not remove RLS policies.
- Do not change production deployment settings.
- Do not make broad refactors unless explicitly requested.
