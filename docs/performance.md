# Performance

## Performance Budget

| Metric | Target | Max |
|--------|--------|-----|
| LCP | ≤2.5s | 4.0s |
| FID | ≤100ms | 300ms |
| CLS | ≤0.1 | 0.25 |
| TTFB | ≤600ms | 1.0s |

## API Latency Budget

| Endpoint | Target | Max |
|----------|--------|-----|
| Auth | ≤200ms | 500ms |
| Dashboard | ≤500ms | 1.0s |
| AI Review | ≤5s | 10s |
| RAG Search | ≤2s | 5s |
| Document Upload | ≤3s | 10s |

## DB Query Performance

- All queries should complete within 200ms
- Use indexes for filtered columns
- Avoid N+1 queries
- Use `EXPLAIN ANALYZE` for slow queries

## Caching Strategy

| Layer | TTL | Use Case |
|-------|-----|----------|
| CDN | 1h | Static assets |
| SWR | 60s | Dashboard data |
| React Query | 5m | Reference data |
| Edge | 1h | Public pages |

## Bundle Size Budget

| Type | Target | Max |
|------|--------|-----|
| Initial JS | ≤300KB | 500KB |
| Initial CSS | ≤50KB | 100KB |
| Images | ≤100KB each | 500KB |

## Rate Limiting

| Resource | Limit |
|----------|-------|
| AI requests | 10/min |
| Document uploads | 5/min |
| API calls | 100/min |
| Login attempts | 5/min |
