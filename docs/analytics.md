# Analytics

## Privacy-safe Event Tracking

Ruletrade-AI tracks product events for improvement purposes only.

Events never include:

- Ticker symbols or stock names
- Portfolio positions or values
- Document contents
- AI prompts or outputs
- Personal notes or memos

Allowed properties:

- Feature usage counts
- Completion rates
- Error types (without content)
- Session IDs
- Timestamps

## Feature Flags

Feature flags enable gradual rollouts:

- `enabled` — global on/off
- `rollout_percentage` — percentage of users
- `target_plans` — plan-based gating
- `target_roles` — role-based gating

## Feedback

Users can submit feedback:

- Bug reports
- Feature requests
- Usability issues
- Other comments

Feedback is public (anonymized) within the app for voting.

## Tables

- `product_events` — anonymized usage events
- `feature_flags` — feature toggle definitions
- `feature_flag_assignments` — per-user overrides
- `feedback_items` — user feedback
- `feedback_votes` — up/down votes

## API

- `POST /api/analytics/events` — track product event
- `GET /api/feedback` — list feedback
- `POST /api/feedback` — create feedback
- `POST /api/feedback/[feedbackId]/vote` — vote on feedback
