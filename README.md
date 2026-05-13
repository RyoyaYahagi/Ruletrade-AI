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

Codex subscription access and OpenAI API access are separate operating surfaces. ChatGPT subscription access can be used from Codex clients such as Codex CLI, IDE integrations, or Codex cloud tasks. A production app server should call OpenAI models through the OpenAI API with server-only credentials and usage controls.

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
