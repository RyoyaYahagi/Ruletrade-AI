# API Reference

All API responses follow this shape:

```json
{
  "ok": true,
  "data": {}
}
```

Errors follow this shape:

```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "requestId": "uuid"
  }
}
```

## API Contract

The canonical API contract is stored in:

```text
openapi/openapi.yaml
```

Generated TypeScript types are stored in:

```text
src/generated/openapi-types.ts
```

Run:

```bash
npm run openapi:lint
npm run openapi:types
```

## Common requirements

- authenticated user
- Zod validation
- ownership check
- safe error response
