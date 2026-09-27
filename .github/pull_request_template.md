## Summary

Describe the problem and resulting behavior.

## Related Issue

Closes #

## Change Area

- [ ] Capture / confirmation
- [ ] Decision timeline / stock pages
- [ ] Review / comparison
- [ ] Transaction history
- [ ] Gemini / Zod schemas
- [ ] SQLite / Drizzle
- [ ] Docs / tooling
- [ ] Operations

## Product / Data Checks

- [ ] Original input is preserved; AI output remains derived data
- [ ] New thoughts append timeline events without overwriting earlier decisions
- [ ] Gemini calls and secrets stay server-side
- [ ] AI output is validated with Zod before saving or displaying it
- [ ] No buy/sell recommendations or investment advice
- [ ] No authentication, ownership layer, or additional AI provider introduced
- [ ] No secrets or database files committed

Mark unrelated items as not applicable in the notes.

## Validation

Report results, or explain why a check could not run.

- `npm run typecheck`:
- `npm run lint`:
- `npm run test`:
- `npm run test:e2e`:

Manual checks / limitations:

## Risks / Recovery

Describe any database compatibility changes, deployment impact, and how to recover if this change fails.
