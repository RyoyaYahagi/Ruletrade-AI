# AGENTS.md

Ruletrade-AI is a personal investment decision journal. Users record their own thinking and review it later. The app does not provide investment advice, buy/sell recommendations, asset management, brokerage services, or order execution.

## Product and architecture

- Treat the user's original words as the source of truth. Preserve historical extraction, transcript, and comparison fields as stored data.
- Save each new thought as a new timeline event; do not overwrite earlier decisions.
- Keep the app focused on ledger storage. AI assistance runs outside the app through Muse; the app does not record audio, transcribe, extract candidates, or generate comparisons.
- The app does not provide investment advice, buy/sell recommendations, or order execution.
- The Web UI is single-user and has no login or ownership layer. Muse integration APIs use separate read/write Bearer tokens; preserve those scopes. Add no Web login or ownership layer unless the product scope changes explicitly.
- Prefer direct use of the existing framework and libraries. Keep domain logic small and easy to change.

## YAGNI

- Do not implement a feature because it might be useful in the future.
- Add an abstraction only when at least two concrete current use cases need it.
- Do not add in-app AI or audio input. The feedback UI and endpoint are not part of the product.
- Do not add repository patterns, factories, or manager layers ahead of a demonstrated need.
- Remove unused code, dependencies, scripts, and documentation when their feature is removed.
- Do not preserve old features with feature flags.
- Before adding a dependency, check whether the standard platform or an existing dependency already solves the need.
- Keep each feature within the fewest useful modules.

## Implementation

- Search for existing related code before adding new logic; extend it when that keeps the design simpler.
- Fail explicitly when required data is missing or an operation fails. Add a fallback only for a stated product requirement, and explain why it is safe where it is used.
- Write comments only for non-obvious intent, external constraints, domain reasons, or relied-on invariants.
- Do not edit `.env.local`, commit real secrets, or commit SQLite/database files.
- Do not change production deployment settings.

## Required checks

Before completing a change, run or report why these checks could not run:

```bash
npm run typecheck
npm run lint
npm run test
npm run test:e2e
```

Do not commit `.skip` or `.only` in tests. When a test fails, investigate the implementation first; change an expectation only when the intended behavior changed and explain why.

## Review

For repository reviews, also apply [the Ruletrade-AI review checklist](.agents/skills/review-checklist/SKILL.md). It supplements these product principles with checks for correctness, test quality, and scope.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
