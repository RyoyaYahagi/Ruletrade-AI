# Local Environment

## SQLite

SQLite and local file storage are initialized automatically when the app starts.

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Common Issues

### Node.js version mismatch

Use nvm or fnm:

```bash
nvm use 20
```

### Database reset

Stop the development server and remove the local SQLite database and storage
directory when a clean local state is needed. The schema is recreated on the
next start.

### Missing env vars

Copy from `.env.example` and fill in your keys.

## Seed Data

The SQLite schema is initialized by `src/lib/db/sqlite-schema.ts`.

## Mock Providers

For local development without real AI/Stripe:

```text
AI_PROVIDER=mock
EMBEDDING_PROVIDER=mock
```
