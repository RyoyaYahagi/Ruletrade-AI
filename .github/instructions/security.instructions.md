---
applyTo: "src/**/*.ts,src/**/*.tsx,supabase/**"
---

# Security Instructions

- Never expose secrets to client code.
- Do not create `NEXT_PUBLIC_` variables for secrets.
- Do not log raw request headers.
- Do not log cookies or Authorization.
- Redact sensitive data before writing logs.
- Destructive actions require ownership checks.
- Cron endpoints must require `CRON_SECRET`.
- Admin clients must be isolated in server-only files.
