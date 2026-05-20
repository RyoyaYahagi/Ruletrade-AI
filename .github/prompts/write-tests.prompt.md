# Write Tests

Add tests for the selected change.

Prefer:

- Unit tests for pure functions
- Component tests for UI state
- API tests for auth/validation/ownership
- RLS tests for user-owned tables
- E2E smoke tests only for core flows

Do not call real external AI or Stripe APIs.

Use Mock Provider and fixtures.
