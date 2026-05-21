# Environments

## Local

- Supabase local stack
- Mock providers (AI, Stripe, Email)
- `.env.local` with test keys
- No real user data

## Preview (PR)

- Vercel preview deployment
- Supabase preview branch
- Sandbox providers
- Used for visual QA and API testing

## Staging

- Vercel production-like deployment
- Supabase staging project
- Sandbox providers
- Final validation before production

## Production

- Vercel production deployment
- Supabase production project
- Live providers (AI, Stripe, Email)
- Real user data

## Environment Variables

| Variable | Local | Preview | Staging | Production |
|----------|-------|---------|---------|------------|
| `NODE_ENV` | development | production | production | production |
| `NEXT_PUBLIC_SUPABASE_URL` | local | preview | staging | prod |
| `SUPABASE_SERVICE_ROLE_KEY` | local key | preview key | staging key | prod key |
| `OPENAI_API_KEY` | mock | sandbox | sandbox | live |
| `STRIPE_SECRET_KEY` | mock | test | test | live |
| `STRIPE_WEBHOOK_SECRET` | mock | test | test | live |

## Secret Classification

- **Public**: NEXT_PUBLIC_ variables
- **Internal**: API URLs, feature flags
- **Confidential**: Service role keys, API keys
- **Restricted**: Production secrets (never in preview)
