# Adding an ownership check

Every user-owned table must have a `user_id` column and every authenticated
service query must scope reads, updates, and deletes to the current user.

```ts
const { data } = await db
  .from("user_owned_table")
  .select("*")
  .eq("user_id", user.id);
```

When adding a user-owned table:

- add an index for common `user_id` queries;
- add tests for own-row access and cross-user isolation;
- never accept the owner ID directly from the client request.
