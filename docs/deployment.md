# Deployment Guide

## Deployment Flow

```
PR merged → Preview → Staging → Production
```

## PR Preview

- Automatically deployed by Vercel
- SQLite storage volume configured for the preview environment
- Run smoke tests

## Staging Deployment

1. Merge to `staging` branch
2. Vercel deploys to staging
3. Run staging smoke tests
4. Check DB migrations
5. Verify feature flags

## Production Deployment

1. Create release PR from `staging` to `main`
2. Run full regression test
3. Deploy with Vercel
4. Verify DB migrations
5. Run production smoke tests
6. Monitor alerts

## Deployment Checklist

- [ ] DB migrations reviewed
- [ ] ownership checks policies reviewed
- [ ] Feature flags configured
- [ ] Environment variables set
- [ ] Secrets rotated if needed
- [ ] Rollback plan documented
- [ ] Monitoring enabled
- [ ] On-call notified

## Preview QA

Before merging PR:

- [ ] Preview URL opens
- [ ] Login works
- [ ] Core feature works
- [ ] No console errors
- [ ] Mobile responsive
