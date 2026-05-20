---
applyTo: "supabase/migrations/**,supabase/tests/**"
---

# RLS Instructions

Every user-owned table must satisfy:

```sql
alter table table_name enable row level security;
```

Basic policy pattern:

```sql
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id)
```

When adding a new policy:

- Add cross-user tests.
- Test User A can read own rows.
- Test User B cannot read User A rows.
- Avoid broad policies like `using (true)`.
