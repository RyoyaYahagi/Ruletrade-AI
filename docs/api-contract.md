# API Contract

Ruletrade-AI API is described with OpenAPI.

## Goals

- keep frontend and backend aligned
- generate TypeScript API types
- lint API descriptions
- support contract tests
- help AI coding agents implement endpoints consistently

## Response shape

Success:

```json
{
  "ok": true,
  "data": {}
}
```

Error:

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

## Rules

- Every endpoint must have an operationId.
- Every endpoint must define success and error responses.
- Authenticated endpoints must define security.
- Request bodies must have schemas.
- Error codes must be documented.
- OpenAPI changes must be reviewed with implementation changes.

## Scripts

```bash
npm run openapi:lint
npm run openapi:types
```

## Files

- `openapi/openapi.yaml` — canonical contract
- `src/generated/openapi-types.ts` — generated TypeScript types
- `src/lib/api/api-client.ts` — typed client
- `src/lib/api/api-error-codes.ts` — error code constants
