# Approval States and Audit Trail

## Rule States

| State | Description | Next States |
|-------|-------------|-------------|
| `draft` | Initial state | in_review, blocked, rejected |
| `in_review` | Under review | blocked, approved, rejected, draft |
| `blocked` | Blocked by warnings | in_review, draft, rejected |
| `approved` | Approved for use | (final) |
| `rejected` | Rejected | draft |

## State Transition Validation

Transitions are validated by `isValidTransition()`:

```typescript
VALID_TRANSITIONS = {
  draft: ["in_review", "blocked", "rejected"],
  in_review: ["blocked", "approved", "rejected", "draft"],
  blocked: ["in_review", "draft", "rejected"],
  approved: [],
  rejected: ["draft"],
};
```

## Audit Trail

Each state change is recorded in `rule_state_transitions`:

| Field | Description |
|-------|-------------|
| rule_id | Linked trading rule |
| from_status | Previous state |
| to_status | New state |
| actor_type | `user`, `system`, or `agent` |
| actor_id | User ID (if applicable) |
| actor_name | Display name |
| reason | Explanation for transition |
| metadata | Additional context |

## Approval Boundary

- Approval and rejection are explicit user actions
- Blocked or unevaluated rules cannot be approved
- The audit trail explains how a rule reached its current state

## Frontend Design

Follow `docs/frontend-design-reference.md` for the investment review-bench structure.
