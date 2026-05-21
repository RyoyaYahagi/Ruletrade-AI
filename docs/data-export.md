# Data Export

## Export Job

```typescript
// Pseudo-code
async function exportUserData(userId: string) {
  const data = {
    profile: await getProfile(userId),
    rules: await getRules(userId),
    reviews: await getReviews(userId),
    documents: await getDocuments(userId),
    watchlist: await getWatchlist(userId),
    portfolio: await getPortfolio(userId),
    notifications: await getNotifications(userId),
  };
  
  return redactInternalData(data);
}
```

## Security

- Export requests are authenticated
- Rate limit: 1 export per 24 hours
- Download links are signed and time-limited
- Exported data is encrypted at rest

## Audit

All export actions are logged:

- Who requested
- When requested
- When completed
- What was included
