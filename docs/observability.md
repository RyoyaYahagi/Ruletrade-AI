# Observability

Ruletrade-AI records AI run logs for improving AI quality, safety, cost, and latency.

## AI Run Logs

Each AI call stores:

- provider
- model
- task_type
- prompt_version
- token usage
- estimated cost
- latency
- schema validation result
- safety result
- error code

Sensitive values are redacted before logging.

AI logs are user-owned and protected by RLS.
