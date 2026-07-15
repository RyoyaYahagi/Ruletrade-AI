# Testing & QA Guide

## Test Strategy

| Level | Scope | When |
|-------|-------|------|
| Unit | Domain logic, validation, calculation | Every PR |
| API | Route handlers, auth, error response | Every PR |
| DB / ownership checks | Cross-user isolation, constraints | Every PR |
| E2E | Critical user journeys | Release candidate |
| Security / Privacy | Secret scan, ownership checks, data leak | Every PR + weekly |

## Unit Test Rules

- Domain logic must be pure and tested without UI/DB/API dependencies
- Validation schemas must reject invalid inputs
- Calculation (PnL, risk limits) must have boundary tests
- AI provider gateway must be mockable

## API Test Rules

- Auth failure returns 401/403
- Validation failure returns 400 with details
- Server error returns 500 without leaking internals
- Admin APIs require admin permission

## E2E Critical Paths

1. Sign up → Log in → Dashboard
2. Create trading rule → Run AI review → Save
3. Upload document → RAG search → View result
4. Create support ticket → Admin reply
5. Billing upgrade → Stripe webhook → Entitlement check

## Regression Checklist

Before release:

- [ ] All unit tests pass
- [ ] All API tests pass
- [ ] SQLite schema initializes cleanly
- [ ] ownership checks prevent cross-user access
- [ ] AI safety checks pass
- [ ] Build succeeds
- [ ] No secrets in client bundle
- [ ] No privileged database access in client code

## Bug Fix Rule

Every bug fix must include a regression test.
