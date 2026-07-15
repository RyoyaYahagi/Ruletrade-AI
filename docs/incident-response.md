# Incident Response

## When something breaks

1. Check `/api/health/deep`
2. Check Vercel Logs
3. Check hosting and application logs
4. Check `system_events` table
5. Check `api_request_logs` for error spikes
6. Identify affected users via `user_id`
7. Trace request via `request_id`

## Common issues

### 5xx spike

- Check `api_request_logs` for failing routes
- Check `system_events` for errors
- Rollback recent deploy if needed

### AI failures

- Check `ai_run_logs` for provider errors
- Check `system_events` for safety/compliance blocks
- Verify AI provider status

### DB slowness

- Check SQLite query and hosting performance metrics
- Run EXPLAIN on slow queries
- Check index usage

### Cron failures

- Check `cron_run_logs`
- Verify `CRON_SECRET` is set
- Check endpoint errors in Vercel Logs

### Webhook failures

- Check `webhook_processing_logs`
- Verify Stripe webhook signature
- Check event idempotency
