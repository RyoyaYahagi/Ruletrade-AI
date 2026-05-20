# Environments

Ruletrade-AI uses four environment classes:

- **Local**: Development and unit testing. Uses mock providers, Supabase local, no production secrets.
- **Preview**: Per-PR verification via Vercel Preview URL. Uses sandbox/mock providers. Must not use production DB.
- **Staging**: Pre-production validation. Uses sandbox providers, production-like configuration, no real user data.
- **Production**: Real users. Uses production providers, production DB, requires deployment gates and rollback plans.

## Rules

- Preview must not use the production database.
- Local must not use production secrets.
- Production secrets must be server-only.
- `NEXT_PUBLIC_` variables are public and must not contain secrets.
- DB migrations must be verified in Preview and Staging before Production.
- Production deployments require a Release Gate, QA Gate, rollback plan, and migration record (if DB changes exist).
