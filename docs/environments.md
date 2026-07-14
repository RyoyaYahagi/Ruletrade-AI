# Environments

## Local

- SQLite local database and local file storage
- Mock providers (AI, Stripe, Email)
- `.env.local` with test keys
- No real user data

## Preview (PR)

- Vercel preview deployment
- Preview SQLite volume
- Sandbox providers
- Used for visual QA and API testing

## Staging

- Vercel production-like deployment
- Staging SQLite volume
- Sandbox providers
- Final validation before production

## Production

- Vercel production deployment
- Production SQLite volume
- Live providers (AI, Stripe, Email)
- Real user data

## Environment Variables

| Variable | Local | Preview | Staging | Production |
|----------|-------|---------|---------|------------|
| `NODE_ENV` | development | production | production | production |
| `SQLITE_DATABASE_PATH` | local | preview | staging | prod |
| `LOCAL_STORAGE_PATH` | local | preview | staging | prod |
| `OPENAI_API_KEY` | mock | sandbox | sandbox | live |
| `STRIPE_SECRET_KEY` | mock | test | test | live |
| `STRIPE_WEBHOOK_SECRET` | mock | test | test | live |

## Secret Classification

- **Public**: NEXT_PUBLIC_ variables
- **Internal**: API URLs, feature flags
- **Confidential**: Service role keys, API keys
- **Restricted**: Production secrets (never in preview)
