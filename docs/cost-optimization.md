# Cost Optimization

## AI Cost Budget

| Feature | Monthly Budget |
|---------|---------------|
| AI Review | $50 |
| RAG Search | $30 |
| Document Analysis | $20 |
| Total AI | $100 |

## Cost Alerts

Trigger at 80% of monthly budget:

- AI token usage
- Storage usage
- Email sends
- Vercel function duration
- Supabase egress

## Optimization Tactics

### AI

- Cache common AI responses
- Use cheaper models for simple tasks
- Batch requests when possible
- Limit max tokens per request

### Storage

- Compress images before upload
- Delete unused documents
- Use CDN for public assets

### DB

- Archive old data
- Use materialized views for analytics
- Monitor connection usage

### Email

- Batch non-urgent emails
- Use transactional for critical only
- Suppress duplicates

## Monitoring

Track weekly:

- AI cost per user
- Storage per user
- DB query time
- Function duration
- Error rate
