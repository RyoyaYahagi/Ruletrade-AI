# Admin Console

Ruletrade-AI Admin Console is an internal operations tool.

## Access

Restricted to users with `admin` role in `app_metadata`.

## Routes

- `/admin` — Dashboard
- `/admin/users` — User list
- `/admin/events` — System events
- `/admin/audit-logs` — Admin audit logs

## Security

- Admin routes require `requireAdmin()`
- Admin tables have RLS enabled
- Service role is isolated in `supabase-admin.ts`
- Admin actions are logged to `admin_audit_logs`
- Sensitive data (investment memos, AI prompts, document text) is not displayed

## Roles

MVP roles:

- `owner` — full access
- `ops` — system events, alerts, jobs
- `support` — user search, feedback, notes
- `viewer` — read-only dashboard

## Audit

Every admin action should be logged to `admin_audit_logs`.

## Restrictions

Admin cannot:

- view full investment memos
- edit user investment rules
- modify AI review results
- change Stripe production state
- delete auth users via UI
- bypass safety or compliance checks
