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

## Common requirements

- authenticated user
- Zod validation
- ownership check
- safe error response
