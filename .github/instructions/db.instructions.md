---
applyTo: "supabase/**,src/lib/db/**,src/features/**/services/**/*.ts"
---

# Database Instructions

- User-owned data must include `user_id`.
- Enable RLS for every user-owned table.
- Add policies for select/insert/update/delete as needed.
- Use `auth.uid()` in RLS policies.
- Do not use service role key in normal user flows.
- Do not modify applied migrations unless explicitly requested.
- Add indexes for common user_id queries.
- Add check constraints for enums.
- Add pgTAP tests for important RLS behavior.
