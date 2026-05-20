# Adding an RLS Policy

Every user-owned table must have RLS enabled.

## Basic select policy

```sql
create policy "Users can read own rows"
on table_name
for select
to authenticated
using ((select auth.uid()) = user_id);
```

## Basic insert policy

```sql
create policy "Users can insert own rows"
on table_name
for insert
to authenticated
with check ((select auth.uid()) = user_id);
```

## Checklist

- RLS enabled
- user_id exists
- select policy
- insert policy
- update policy
- delete policy if needed
- cross-user test
