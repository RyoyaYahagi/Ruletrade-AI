---
applyTo: "src/lib/db/**,src/features/**/services/**/*.ts"
---

# Database Instructions

- User-owned data must include `user_id`.
- Enforce ownership in every authenticated service query.
- Add indexes for common `user_id` queries.
- Keep the local database file server-only.
- Do not use service role key in normal user flows.
- Add check constraints for enums.
