# RLS Overview

Row Level Security protects user-owned data.

## Rule

A user can only read and write rows where:

```sql
auth.uid() = user_id
```

## Important

The service role key bypasses RLS.

Do not use the service role key in normal user APIs.

Use it only for explicit admin operations such as account deletion.
