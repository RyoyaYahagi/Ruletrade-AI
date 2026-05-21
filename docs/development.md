# Development Guide

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for Supabase local stack)
- Git

## Setup

```bash
# 1. Clone
git clone https://github.com/RyoyaYahagi/Ruletrade-AI.git
cd Ruletrade-AI

# 2. Install dependencies
pnpm install

# 3. Copy environment file
cp .env.example .env.local

# 4. Start Supabase locally
pnpm supabase:start

# 5. Run migrations
pnpm supabase:migrate

# 6. Seed data (optional)
pnpm db:seed

# 7. Start dev server
pnpm dev
```

## Environment Variables

Edit `.env.local` with your keys.

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
STRIPE_SECRET_KEY=
```

## Available Scripts

```bash
pnpm dev          # Start Next.js dev server
pnpm build        # Production build
pnpm typecheck    # TypeScript check
pnpm lint         # ESLint
pnpm test         # Unit tests
pnpm supabase:start   # Start local Supabase
pnpm supabase:stop    # Stop local Supabase
pnpm db:seed      # Seed local DB
```

## Project Structure

```text
src/
  app/          # Next.js App Router
  features/     # Domain features (services, components)
  schemas/      # Zod schemas
  lib/          # Shared utilities
supabase/
  migrations/   # Database migrations
```

## Before Committing

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Troubleshooting

See [docs/local-environment.md](./local-environment.md)
