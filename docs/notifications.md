# Notifications MVP

Ruletrade-AI notifications are reminders for rule review, not trading signals.

## Purpose

Notifications help users:

- answer pending rule questions
- review incomplete rules
- finalize high-quality rules
- create rule sessions from watchlist items
- review portfolio positions without rules
- check completed document summaries

## What notifications do NOT do

- recommend buying or selling
- provide price alerts
- give trading signals
- create urgency around market timing

## Channels

### MVP: In-app only

In-app notifications are:

- easy to implement
- no browser permission needed
- safe
- easy to keep history

### Future: Web Push

Requirements:

- HTTPS
- Service Worker
- user permission
- browser compatibility
- VAPID keys

### Future: Email

Candidates:

- Resend
- SendGrid
- Postmark

## Notification types

| type                          | purpose                           |
| ----------------------------- | --------------------------------- |
| rule_review_due               | remind to review a saved rule     |
| rule_questions_pending        | unanswered questions exist        |
| rule_quality_gate_failed      | rule has unset fields             |
| rule_finalizable              | rule is ready to finalize         |
| watchlist_item_needs_rule     | watchlist item needs rule session |
| watchlist_review_due          | watchlist review reminder         |
| portfolio_missing_rules       | active positions without rules    |
| portfolio_review_due          | portfolio review reminder         |
| document_extraction_completed | document text extracted           |
| document_summary_completed    | AI summary ready                  |
| document_index_failed         | document RAG indexing failed      |
| system_notice                 | system announcements              |

## Safety

All notification text goes through Safety Check.

If Safety Check fails:

- title/body are replaced with safe defaults
- `safety_passed` is set to false
- notification is still created but with safe text

## Rate limiting

- same target + notification_type: 24h cooldown
- max notifications per day: configurable per user (default 5)
- cron batch limit: 500 users per run

## Cron

Endpoint: `GET /api/cron/notifications/check`

Protected by `CRON_SECRET` via `Authorization: Bearer` header.

## DB tables

- `notification_preferences`
- `notifications`
- `notification_delivery_logs`
- `notification_rules`

All user-owned tables are accessed through explicit ownership checks.
