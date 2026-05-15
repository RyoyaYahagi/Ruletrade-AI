# Ruletrade-AI

AIと一緒に投資ルールを作成・レビューするアプリです。

## Safety

Ruletrade-AI does not provide investment advice.

AI output is used to identify missing rule-design elements, clarify assumptions, and generate follow-up questions. It is checked before display. Outputs that look like buy/sell recommendations, price predictions, or profit guarantees are blocked.

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
npx supabase --help
npm run db:start
npm run db:status
npm run db:stop
```

`npm run db:start` requires Docker Desktop to be running. The first Supabase CLI
run may download the CLI through `npx` if it is not already available in your
environment. If `npm run db:status` reports that the local Supabase container
does not exist, start it with `npm run db:start`.

Rule creation tables use Supabase Row Level Security to keep user-owned data
isolated. See `docs/security.md` for the policy shape and
`tests/safety/rule_creation_rls_checks.sql` for manual verification queries.

### Scripts

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run db:start
npm run db:status
npm run db:stop
```

### First Run Check

After setup, run:

```bash
npm run dev
```

Open `http://localhost:3000` and confirm the app responds with the
Ruletrade-AI workbench. For a quick terminal check:

```bash
curl -I http://localhost:3000
```

The response should return `HTTP/1.1 200 OK`.

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
NEXT_PUBLIC_STRIPE_SECRET_KEY=
```

Files that read secrets must stay server-only. Add `import "server-only";` to server-only modules that access API keys or service role credentials.

## Auth

This project uses Supabase Auth with `@supabase/ssr`.

Supabase clients are separated by runtime:

- Browser client: Client Components only, using public Supabase URL and anon key.
- Server client: Server Components, Server Actions, and Route Handlers using cookie-backed sessions.
- Admin client: server-only privileged operations that truly require the service role key.

Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code and never create
`NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`.

For local auth callbacks, configure Supabase with:

```text
Site URL:
http://localhost:3000

Redirect URL:
http://localhost:3000/auth/callback
```

The initial protected route is `/dashboard`. The initial auth status API is
`/api/me`.

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

## Safety

Ruletrade-AI does not provide investment advice.

- AI output is used to identify missing rule-design elements, clarify assumptions, and generate follow-up questions.
- AI output is checked before display. Outputs that look like buy/sell recommendations or guaranteed predictions are blocked.
- The Safety Check layer scans AI-generated text for prohibited phrases (e.g. buy/sell recommendations, price predictions, profit guarantees, urgency pressure, privacy risks) and enforces a `block` / `warn` / `allow` decision.
- See `docs/safety.md` for the full Safety Policy and prohibited phrase categories.

## Project Structure

This repository uses the Next.js `src` directory convention. The App Router
lives in `src/app`, while reusable product code lives under feature and shared
infrastructure directories.

```text
src/
  app/
    page.tsx
    layout.tsx
  components/
    ui/
  features/
    rules/
      components/
      services/
  lib/
  schemas/
    rules/
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

### Placement Rules

- `src/app/`: Next.js App Router pages, layouts, and route handlers. Keep these
  files thin and delegate product behavior to feature modules or shared
  services.
- `src/features/rules/`: MVP rule creation and review UI, workflow services,
  prompt builders, hooks, and feature-local types.
- `src/components/ui/`: reusable shadcn-style UI primitives that do not know
  about trading concepts.
- `src/lib/`: shared infrastructure such as auth, database clients, provider
  gateways, errors, safety checks, config, and utilities.
- `src/schemas/`: shared validation-ready domain schemas. Rule schemas live in
  `src/schemas/rules/`.
- `supabase/migrations/` and `supabase/seed/`: database schema changes and
  non-production seed data.
- `tests/`: unit, API, schema, RLS, safety, eval, and E2E coverage.

Use the `@/*` import alias for code under `src/`. Prefer direct imports over
barrel exports during the MVP so feature boundaries remain visible.

### MVP vs Future Structure

Create only the directories needed by the active MVP issue. Future feature
areas such as portfolio, watchlist, documents, billing, notifications, RAG,
analytics, and eval infrastructure should be added when their implementation
issues start, not as empty placeholders.

Server-only modules that read secrets or privileged credentials must include
`import "server-only";`. Browser code must never import provider gateways,
service-role Supabase clients, Stripe secret clients, or other privileged
runtime modules directly.
