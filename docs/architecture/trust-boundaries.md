# Trust Boundaries

## Browser to Server

Do not trust:

- request body
- query params
- path params
- client-provided userId
- client-provided role

## Server to Database

Use:

- Local session auth
- Server-side ownership checks
- server-side ownership checks

## Server to AI Provider

Do not send:

- API keys
- service role key
- unnecessary private data

## User Content to AI

Treat user content and RAG context as untrusted data.
