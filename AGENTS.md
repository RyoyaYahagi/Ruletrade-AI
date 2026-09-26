# AGENTS.md

Ruletrade-AI is a local-first investment decision journal.

The app records what the user thought at the time of a trade, then helps the user compare a later opinion with those past notes. It does not recommend what to buy or sell.

## MVP rules

- Prefer deleting concepts over introducing abstractions.
- Do not add a feature because it may be useful later. Add it only for a current user workflow.
- The source of truth is what the user recorded at that time. AI-extracted fields are editable derived data.
- Keep decisions append-only in normal flows. New thinking should become a new decision/review, not silently rewrite history.
- AI may structure, summarize, transcribe, and compare the user's own notes. It must not output buy/sell recommendations.
- Keep provider code Gemini-only until a real requirement justifies a provider abstraction.
- Do not add RAG until stock history no longer fits reasonably in one prompt.
- Do not add auth until the app needs multiple users or public deployment.
- Do not add OpenAPI, billing, PDF ingestion, agents, backtests, portfolio optimization, or market/news integrations to the MVP.

## Current stack

- Next.js App Router
- React + TypeScript
- plain CSS
- SQLite via better-sqlite3
- Zod
- Gemini REST API
- Vitest

## Required checks

Before merging changes:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Safety

- Never expose GEMINI_API_KEY to client code.
- Do not commit .env files or SQLite database files.
- AI review must compare past and present user notes, not decide an investment action.
