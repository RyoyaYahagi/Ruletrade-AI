---
applyTo: "src/app/api/**,src/lib/api/**,openapi/**,tests/api/**"
---

# API Contract Instructions

When adding or changing an API endpoint:

- Update OpenAPI files.
- Add or update Zod request schema.
- Keep API response shape `{ ok: true, data }`.
- Keep error response shape `{ ok: false, error }`.
- Add operationId.
- Add request body schema if needed.
- Add success response schema.
- Add common error responses.
- Regenerate TypeScript types.
- Add API tests.
- Do not trust userId from the client.
- Do not expose secrets.
- Do not bypass Safety or Compliance.
