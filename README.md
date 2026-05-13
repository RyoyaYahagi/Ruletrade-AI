# Ruletrade-AI

AIと一緒に投資ルールを作成・レビューするアプリです。

## Development

### Requirements

- Node.js 20.9+
- Docker
- npm

### Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000` and confirm that `Ruletrade-AI` is displayed.

### Supabase Local

```bash
npx supabase init
npx supabase start
```

`npx supabase start` requires Docker Desktop to be running.

### Scripts

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
```

## Secret Management

Do not call OpenAI, Anthropic Claude, Gemini, Stripe, or Supabase Admin APIs directly from the browser.

Client components should call internal API routes, Server Actions, or Supabase Edge Functions.

```text
Browser
  ↓
Next.js API Route / Server Action / Supabase Edge Function
  ↓
AI Provider Gateway / Supabase Admin / Stripe
  ↓
OpenAI / Anthropic Claude / Gemini / Supabase / Stripe
```

Use `.env.local` only for local development. Do not commit `.env.local`.

Use Vercel Environment Variables, Supabase Edge Function Secrets, GitHub Actions Secrets, or a managed Secret Manager in deployed environments.

### Public Environment Variables

Only values that may be exposed to the browser should use `NEXT_PUBLIC_`.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

### Server-only Environment Variables

Never create public versions of these variables.

```env
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
CRON_SECRET=
VAPID_PRIVATE_KEY=
```

Never create these variables:

```env
NEXT_PUBLIC_OPENAI_API_KEY=
NEXT_PUBLIC_ANTHROPIC_API_KEY=
NEXT_PUBLIC_GEMINI_API_KEY=
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=
```

Files that read secrets must stay server-only. Add `import "server-only";` to server-only modules that access API keys or service role credentials.

### AI Provider Configuration

Local development starts with the mock provider.

```env
AI_PROVIDER=mock
```

Development-only assistant tooling can be documented separately from production AI execution.

```env
DEVELOPMENT_AI_ASSISTANT=codex-sdk
```

Supported provider keys are prepared for later gateway implementation:

```env
OPENAI_API_KEY=
OPENAI_MODEL=
OPENAI_CODEX_MODEL=

ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=

GEMINI_API_KEY=
GEMINI_MODEL=
```

Claude access must go through the server-side AI Provider Gateway. Client Components must never import Anthropic SDKs or read `ANTHROPIC_API_KEY`.

### Codex SDK for Development Only

Use the SDK/API route for development-only Codex experiments when the app needs a programmable integration point.

Do not wire Codex access into production user-facing AI execution. Production routes should call the server-side AI Provider Gateway with explicit provider credentials, usage limits, audit logging, and safety checks.

For local development, prefer:

```text
Development tool / local script
  ↓
OpenAI SDK / Responses API
  ↓
Codex-capable model
  ↓
Generated implementation notes, test drafts, or debug suggestions
```

Keep this separate from the product runtime:

```text
Browser / user-facing feature
  ↓
Next.js API Route / Server Action
  ↓
AI Provider Gateway
  ↓
OpenAI / Anthropic Claude / Gemini
```

Allowed development uses:

- Running local SDK scripts for repository analysis
- Running Codex CLI or Codex app tasks against the local repository
- Generating implementation plans and review notes
- Drafting tests, fixtures, and migration checks
- Debugging local build, lint, and type errors

Not allowed:

- Calling Codex SDK/API experiments from browser code
- Calling Codex SDK/API experiments from production API routes
- Treating a personal ChatGPT/Codex session as a shared backend credential
- Bypassing AI Provider Gateway cost limits, safety checks, or logs for user-facing features

## Project Structure

```text
src/
  app/
  components/
  features/
  lib/
  schemas/
  types/

docs/
  adr/

tests/
  unit/
  schemas/
  services/
  api/
  safety/
  evals/
  e2e/
  fixtures/

supabase/
  migrations/
  seed/
```
