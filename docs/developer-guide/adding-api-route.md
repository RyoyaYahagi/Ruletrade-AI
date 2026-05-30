# Adding an API Route

All API routes should follow the same structure.

## Required

- requireUser
- Zod validation
- ownership check
- safe error response
- requestId
- rate/cost limit if AI is used
- audit log if destructive

## Example flow

```text
request
  ↓
requireUser
  ↓
validate body
  ↓
check ownership
  ↓
call service
  ↓
return apiSuccess
```

## Never trust

- userId from client
- ownerId from client
- role from client
- target table name from client
