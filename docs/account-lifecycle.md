# Account Lifecycle

## States

```
active → deactivated → deleted
  ↓        ↓              ↓
  Reactivation possible within 30 days
```

## Active

- Full access to all features
- Billing active
- Data retained normally

## Deactivated

- User initiated
- Login blocked
- Data retained for 30 days
- Reactivation possible
- Billing paused

## Deleted

- User initiated or after 30 days of deactivation
- All personal data removed
- Anonymized usage statistics retained
- Billing subscription cancelled
- Support tickets anonymized

## Reactivation

Within 30 days of deactivation:

- Login re-enabled
- Data restored
- Billing resumed

## Admin Actions

- Admin can view account status
- Admin can manually trigger deletion
- Admin cannot reactivate (user only)

## Notifications

| Event | Email | Timing |
|-------|-------|--------|
| Deactivation | Confirmation | Immediate |
| Deletion warning | Reminder | Day 25 of deactivation |
| Deletion | Confirmation | After deletion |
| Reactivation | Welcome back | Immediate |
