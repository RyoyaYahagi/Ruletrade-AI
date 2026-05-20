# Observability

Ruletrade-AI observability strategy:

- measure before reacting
- every API request has a requestId
- logs are structured
- secrets and investment content are never logged
- AI payload logging is off by default in production
- cron / webhook / privacy delete are always monitored
- never weaken RLS or safety for observability

## Logs

### API Request Logs

Stored in `api_request_logs`.

Fields:

- request_id
- user_id
- route
- method
- status_code
- duration_ms
- error_code

### System Events

Stored in `system_events`.

Fields:

- event_type
- severity
- message
- request_id
- user_id
- route
- error_code
- duration_ms
- metadata

### Health Check Logs

Stored in `health_check_logs`.

Fields:

- check_name
- status
- latency_ms
- message
- metadata

### Cron Run Logs

Stored in `cron_run_logs`.

Fields:

- cron_name
- status
- started_at
- finished_at
- error_message
- items_processed

### Webhook Processing Logs

Stored in `webhook_processing_logs`.

Fields:

- provider
- event_type
- external_event_id
- status
- duration_ms
- error_message
- metadata

## Health Endpoints

### /api/health

Basic health check.

### /api/health/deep

Deep health check including:

- DB connectivity
- latency measurement
- health check log recording

## Alert Rules

Start small:

- 5xx rate increase
- API latency p95 > 2000ms
- AI timeout rate increase
- Cron failure
- Webhook verification failure
- Privacy delete failure

## Security

Never log:

- ticker
- company name
- investment memo
- AI prompt / output
- document text
- filename
- email
- token / cookie / authorization header

## Tools

- Vercel Logs
- Supabase Logs
- Supabase Performance Advisor
- Structured logs in DB
- Health endpoints
