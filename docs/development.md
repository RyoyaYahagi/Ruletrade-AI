# Development Guide

## Prerequisites

- Node.js 20+
- npm
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

# 4. Start dev server (SQLite schema is initialized automatically)
npm run dev
```

## Environment Variables

Edit `.env.local` with your keys.

```text
SQLITE_DATABASE_PATH=./data/ruletrade.sqlite
LOCAL_STORAGE_PATH=./data/storage
OPENAI_API_KEY=
STRIPE_SECRET_KEY=
```

## Available Scripts

```bash
npm run dev       # Start Next.js dev server
npm run build     # Production build
npm run typecheck # TypeScript check
npm run lint      # ESLint
npm run test      # Unit tests
npm run test:e2e  # E2E tests
```

## Project Structure

```text
src/
  app/          # Next.js App Router
  features/     # Domain features (services, components)
  schemas/      # Zod schemas
  lib/          # Shared utilities
data/
  ruletrade.sqlite # Local database
  storage/         # Local uploaded files
```

## Before Committing

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Troubleshooting

See [docs/local-environment.md](./local-environment.md)
