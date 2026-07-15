# Operations

This document describes production operations for Ruletrade-AI.

## Smoke Tests

Run after each production deploy:

- Health check
- Auth
- Rule Session
- AI Review
- Document upload
- RAG index
- Notifications

## Rollback

Use Vercel deployment rollback first.

Database rollback should be handled with forward-only corrective migrations.

## Incident Response

1. Identify impact
2. Roll back app if needed
3. Disable risky feature flags
4. Pause cron if needed
5. Review logs
6. Write post-incident notes
