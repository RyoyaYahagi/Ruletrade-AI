# Data Portability

## User Rights

Users can:

- Export all their data
- Request data deletion
- Deactivate their account
- Reactivate within 30 days

## Export Format

JSON package containing:

```text
profile.json
rules.json
reviews.json
documents.json
watchlist.json
portfolio.json
notifications.json
privacy_requests.json
support_tickets.json
billing.json
```

## Export Workflow

1. User requests export from settings
2. System queues export job
3. Job collects all user data
4. Data is redacted (remove internal IDs, service data)
5. JSON package is generated
6. Download link emailed to user
7. Link expires in 7 days

## Redaction Rules

- Remove internal database IDs
- Remove system metadata (created_at for internal tables)
- Remove admin notes
- Keep user-facing data only

## Import Readiness

Future support for:

- Import from export package
- Migrate from other platforms
- Bulk data upload (admin only)
