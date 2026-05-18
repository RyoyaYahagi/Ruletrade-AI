# Deployment

Ruletrade-AI deployments must pass the relevant gates before production.

## Preview

Used for PR review. Build must pass. Smoke test must pass. No production DB or secrets.

## Staging

Used for production-like validation. Migration, RLS, AI Safety, Privacy, and Smoke tests must pass.

## Production

Requires:

- Release Gate (if enabled)
- QA Gate (if enabled)
- Rollback plan (if enabled)
- Monitoring readiness
- Migration record if DB changes exist
- Post-deploy smoke test

Use the Admin Console `/admin/deployments/production-gate` to evaluate gates.
