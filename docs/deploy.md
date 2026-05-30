# Deploy

Ruletrade-AI is deployed with Vercel and Supabase.

## Environments

- Local
- Preview
- Production

## Environment Variables

Only public values may use `NEXT_PUBLIC_`.

Secrets such as AI API keys, Supabase Service Role Key, and Cron Secret must be server-only.

## Supabase

Database changes are managed with migrations.

Use:

```bash
supabase db push
```

after reviewing migration files.

## Production Checklist

Before production release:

- Check environment variables
- Apply migrations
- Confirm RLS
- Confirm Storage policies
- Run smoke tests
