# Testing

## Test Structure

| Layer     | Tool             | Directory               |
| --------- | ---------------- | ----------------------- |
| Unit      | vitest           | `tests/`                |
| E2E       | Playwright       | `tests/e2e/`            |
| RLS       | SQL + Playwright | `tests/e2e/rls.spec.ts` |
| AI Safety | vitest           | `tests/lib/safety/`     |

## Running Tests

```bash
npm test              # Unit tests
npm run test:e2e      # E2E tests
npm run test:rls      # RLS review queries
```

## AI Safety Testing

Prohibited phrase detection is tested in `tests/lib/safety/prohibited-phrases.test.ts`.

## RLS Testing

Run Supabase review queries:

```bash
psql -f supabase/migrations/20260524000000_security_review.sql
```

## CI

GitHub Actions runs typecheck → lint → test → build.
