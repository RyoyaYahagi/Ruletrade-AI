# Rollback & Forward-fix

## Rollback Strategy

### App-only Rollback

```bash
# Revert to previous deployment
vercel --prod
```

Use when: no DB migration, no breaking API change

### DB Forward-fix

When migration has run and cannot be rolled back:

1. Create forward-migration
2. Deploy app + migration together
3. Verify data integrity

### Feature Flag Rollback

```
Disable feature in launch_stop_switches
```

Use when: feature has independent stop switch

## Incident Response

1. Assess scope
2. Stop the bleeding (feature flag / deployment)
3. Fix or rollback
4. Verify fix
5. Postmortem

## Forward-fix Required When

- DB schema changed
- Data migration ran
- External API contract changed
- ownership checks policy changed
