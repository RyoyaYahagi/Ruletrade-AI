# Backup & Disaster Recovery

## What we protect

- Postgres DB (Supabase)
- Supabase Storage objects
- Vercel deployment (rollback)
- App config / env vars

## RPO / RTO

| Tier   | Data                             | RPO | RTO | Recovery method                    |
| ------ | -------------------------------- | --- | --- | ---------------------------------- |
| Tier 1 | User accounts, rules, portfolios | 1h  | 2h  | Supabase PITR or pg_dump restore   |
| Tier 2 | Documents, memos, AI outputs     | 4h  | 4h  | Logical backup + selective restore |
| Tier 3 | Audit logs, legal acceptances    | 24h | 8h  | Long-term backup archive           |

## Backup policy

- Supabase automated backups: daily snapshots (enabled by default on Pro)
- Logical backup: weekly `pg_dump` to encrypted storage
- Storage objects: weekly inventory + checksum verification
- Before destructive migration: manual snapshot + approval

## Restore policy

- Restore only to staging/local first
- Verify RLS policies after restore
- Verify privacy delete consistency after restore
- Document restore time and issues in `restore_drills`

## Incident severity & recovery decision

| Severity             | Decision                              |
| -------------------- | ------------------------------------- |
| P1 (service down)    | Vercel rollback + DB PITR             |
| P2 (data corruption) | Feature flag OFF + DB forward-fix     |
| P3 (partial loss)    | Selective restore from logical backup |
| P4 (minor bug)       | Hotfix deploy                         |

## Runbook: Vercel rollback

1. `vercel rollback --prod`
2. Verify health endpoint `/api/health`
3. Verify critical API responses
4. Notify team

## Runbook: DB restore

1. Pause production writes (maintenance mode)
2. Restore from Supabase dashboard or `pg_dump`
3. Run smoke tests
4. Verify RLS
5. Resume writes

## Runbook: Storage restore

1. Identify missing objects from inventory
2. Restore from object-level backup
3. Verify DB metadata consistency
4. Run privacy delete reconciliation if needed

## Privacy delete & backup

- Never restore privacy-deleted rows without reconciliation
- After restore, run privacy delete reconciliation job
- Backup retention must respect deletion requests

## Migration safety

- Never rewrite existing migrations
- Destructive migrations require: pre-backup, approval, forward-fix plan
- After migration: RLS / privacy / billing / smoke check
