# Local Setup

## Requirements

- Node.js 22+
- npm
- Supabase CLI
- Docker
- Git

## Setup

```bash
npm install
cp .env.example .env.local
supabase start
supabase db reset
npm run dev
```

## Test

```bash
npm run typecheck
npm run lint
npm run test
npm run test:e2e
supabase test db
```
