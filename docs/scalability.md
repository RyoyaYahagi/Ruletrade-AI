# Scalability

## Scaling Strategy

### Horizontal

- Stateless API design
- Edge functions for global distribution
- CDN for static assets

### Vertical

- Connection pooling for DB
- Read replicas for analytics
- Vector DB for RAG at scale

## Background Jobs

Use queue for heavy operations:

- Document processing
- AI review generation
- Email sending
- Analytics aggregation
- Backup

## Data Growth

| Table | Growth Rate | Retention |
|-------|-------------|-----------|
| trade_entries | High | 2 years |
| ai_reviews | Medium | 1 year |
| documents | Medium | Until deleted |
| logs | High | 30 days |
| audit_logs | Medium | 1 year |

## Connection Limits

- SQLite: single-writer WAL mode with a durable file volume
- Vercel: 1000 concurrent functions
- AI provider: Account limits
