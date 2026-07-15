# Email

Transactional email infrastructure for Ruletrade-AI.

## Providers

- `mock` — logs to console (default for dev/test)
- `resend` — Resend API (production)

Configure with `EMAIL_PROVIDER` and `RESEND_API_KEY`.

## Sending

Use `sendEmail()` from `src/lib/email/send-email.ts`.

Features:

- Suppression list check
- Idempotency key deduplication
- Send logging to `email_send_logs`

## Never include in emails

- Investment memo content
- AI prompt / output
- Document text or filenames
- Portfolio details
- API keys / tokens

## Tables

- `email_send_logs` — send history
- `email_suppressions` — bounce / complaint / unsubscribe list
- `email_preferences` — per-user opt-in settings

## Auth email

Local auth handles sign-up. Password reset flows are implemented as server-side
application services.
Use Custom SMTP for production deliverability.
