# Launch Readiness

Before each launch phase, complete the launch readiness checklist.

## Go criteria

- RLS tests pass
- Safety / Compliance tests pass
- Privacy delete tests pass
- Observability works
- Admin Console works
- Backup / rollback runbooks exist
- Feedback flow works
- Stop switches work

## No-Go criteria

- Cross-user data access risk
- Service role key exposure risk
- AI buy/sell recommendation displayed
- Privacy delete failure
- Billing / webhook instability
- Admin access control failure

## Checklist categories

- product
- auth
- db / rls
- ai_safety
- rag
- privacy
- security
- legal
- billing
- observability
- performance
- backup
- admin
- docs
- support

## Reviews

Launch readiness reviews are recorded in `launch_readiness_reviews` with status:

- draft
- in_review
- go
- no_go
- blocked
