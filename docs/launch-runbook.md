# Launch Runbook

## Launch Day Checklist

### T-2 Hours

- [ ] All systems green on monitoring
- [ ] On-call engineer confirmed
- [ ] Rollback plan reviewed
- [ ] Feature flags configured
- [ ] Database migration verified

### T-0 (Launch)

- [ ] Deploy to production
- [ ] Verify deployment success
- [ ] Run smoke tests
- [ ] Check error rates
- [ ] Monitor user signups

### T+1 Hour

- [ ] Review metrics
- [ ] Check support channels
- [ ] Verify billing working
- [ ] Confirm AI responses

### T+4 Hours

- [ ] Full health check
- [ ] Review any incidents
- [ ] Communicate status

## Emergency Procedures

### Stop Launch

```bash
# Disable new signups
pnpm toggle-feature signup false

# Enable maintenance mode
pnpm maintenance-mode on
```

### Rollback

```bash
# Rollback to previous version
vercel --prod --confirm

# Or disable specific feature
pnpm toggle-feature ai-review false
```

### Incident Response

1. Assess severity
2. Page on-call if needed
3. Communicate in Slack
4. Fix or rollback
5. Postmortem within 24 hours
