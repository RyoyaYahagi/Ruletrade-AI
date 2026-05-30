# Deployment Runbook

## Pre-deploy

- [ ] All tests pass
- [ ] Typecheck clean
- [ ] Build succeeds
- [ ] Migration reviewed (if any)
- [ ] Backup confirmed (for destructive migration)

## Deploy

- [ ] Deploy to Vercel
- [ ] Run health check
- [ ] Run smoke tests
- [ ] Verify critical user journeys

## Rollback

- [ ] `vercel rollback --prod`
- [ ] Verify health check
- [ ] Notify team
