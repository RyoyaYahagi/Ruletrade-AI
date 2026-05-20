---
applyTo: "tests/**,src/**/*.test.ts,src/**/*.test.tsx,supabase/tests/**"
---

# Testing Instructions

- Unit test pure logic.
- API test auth, validation, and ownership.
- RLS test cross-user isolation.
- Use Mock AI Provider.
- Do not call real OpenAI/Gemini in CI.
- Do not call real Stripe in CI.
- Do not skip failing tests to pass CI.
