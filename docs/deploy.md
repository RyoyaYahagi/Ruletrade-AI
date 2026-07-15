# Deploy

Ruletrade-AI is deployed with the selected hosting platform and a durable
SQLite volume.

## Environments

- Local
- Preview
- Production

## Environment Variables

Only public values may use `NEXT_PUBLIC_`.

AI API keys and the Cron Secret must be server-only. Configure
`SQLITE_DATABASE_PATH` and `LOCAL_STORAGE_PATH` on a durable volume.

## Production Checklist

Before production release:

- Check environment variables
- Confirm the SQLite path and storage volume are writable
- Confirm ownership checks
- Run smoke tests
