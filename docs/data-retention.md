# Data Retention

## Retention periods

| Data category                         | Retention              | Action after period                     |
| ------------------------------------- | ---------------------- | --------------------------------------- |
| AI prompt / output / document text    | 30 days                | Hard delete                             |
| Rule funnel raw events                | 30 days                | Hard delete                             |
| Rule analytics daily aggregates       | 1 year                 | Hard delete                             |
| Session / client logs                 | 30 days                | Hard delete                             |
| User-generated content (rules, memos) | Until account deletion | Soft delete → hard delete after 30 days |
| Billing records                       | 7 years                | Archive only                            |
| Legal acceptances                     | Indefinite             | Keep with audit trail                   |
| Admin audit logs                      | 2 years                | Archive then delete                     |
| Feedback / NPS                        | 1 year                 | Anonymize then delete                   |

## Soft delete

- `deleted_at` timestamp on relevant tables
- Filtered by default in application queries
- Hard delete after grace period

## Hard delete

- Permanent removal from DB
- Corresponding Storage objects removed
- Privacy delete reconciliation run after

## Purge automation

- Scheduled job runs nightly
- Logs to `data_purge_log`
- Failures alert ops channel
