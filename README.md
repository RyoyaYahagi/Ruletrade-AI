     1|# Ruletrade-AI
     2|
     3|AIと一緒に投資ルールを作成・レビューするアプリです。
     4|
     5|## Safety
     6|
     7|Ruletrade-AI does not provide investment advice.
     8|
     9|AI output is used to identify missing rule-design elements, clarify assumptions, and generate follow-up questions. It is checked before display. Outputs that look like buy/sell recommendations, price predictions, or profit guarantees are blocked.
    10|
    11|## Roadmap
    12|
    13|Ruletrade-AI is built in milestones:
    14|
    15|- v0.1 Foundation
    16|- v0.2 Rule Creation MVP
    17|- v0.3 AI Review / Safety MVP
    18|- v0.4 Memory / RAG MVP
    19|- v0.5 Product Expansion MVP
    20|- v1.0 Closed Beta
    21|
    22|See:
    23|
    24|- docs/roadmap.md
    25|- docs/release.md
    26|- CHANGELOG.md
    27|- LEARNING_LOG.md
    28|
    29|## Development
    30|
    31|### Requirements
    32|
    33|- Node.js 20.9+
    34|- Docker
    35|- npm
    36|
    37|### Setup
    38|
    39|```bash
    40|npm install
    41|cp .env.example .env.local
    42|npm run dev
    43|```
    44|
    45|Open `http://localhost:3000` and confirm that `Ruletrade-AI` is displayed.
    46|
    47|### Supabase Local
    48|
    49|```bash
    50|npx supabase --help
    51|npm run db:start
    52|npm run db:status
    53|npm run db:stop
    54|```
    55|
    56|`npm run db:start` requires Docker Desktop to be running. The first Supabase CLI
    57|run may download the CLI through `npx` if it is not already available in your
    58|environment. If `npm run db:status` reports that the local Supabase container
    59|does not exist, start it with `npm run db:start`.
    60|
    61|Rule creation tables use Supabase Row Level Security to keep user-owned data
    62|isolated. See `docs/security.md` for the policy shape and
    63|`tests/safety/rule_creation_rls_checks.sql` for manual verification queries.
    64|
    65|### Scripts
    66|
    67|```bash
    68|npm run dev
    69|npm run build
    70|npm run lint
    71|npm run typecheck
    72|npm run db:start
    73|npm run db:status
    74|npm run db:stop
    75|```
    76|
    77|### First Run Check
    78|
    79|After setup, run:
    80|
    81|```bash
    82|npm run dev
    83|```
    84|
    85|Open `http://localhost:3000` and confirm the app responds with the
    86|Ruletrade-AI workbench. For a quick terminal check:
    87|
    88|```bash
    89|curl -I http://localhost:3000
    90|```
    91|
    92|The response should return `HTTP/1.1 200 OK`.
    93|
    94|## Secret Management
    95|
    96|Do not call OpenAI, Anthropic Claude, Gemini, Stripe, or Supabase Admin APIs directly from the browser.
    97|
    98|Client components should call internal API routes, Server Actions, or Supabase Edge Functions.
    99|
   100|```text
   101|Browser
   102|  ↓
   103|Next.js API Route / Server Action / Supabase Edge Function
   104|  ↓
   105|AI Provider Gateway / Supabase Admin / Stripe
   106|  ↓
   107|OpenAI / Anthropic Claude / Gemini / Supabase / Stripe
   108|```
   109|
   110|Use `.env.local` only for local development. Do not commit `.env.local`.
   111|
   112|Use Vercel Environment Variables, Supabase Edge Function Secrets, GitHub Actions Secrets, or a managed Secret Manager in deployed environments.
   113|
   114|### Public Environment Variables
   115|
   116|Only values that may be exposed to the browser should use `NEXT_PUBLIC_`.
   117|
   118|```env
   119|NEXT_PUBLIC_SUPABASE_URL=
   120|NEXT_PUBLIC_SUPABASE_ANON_KEY=
   121|```
   122|
   123|### Server-only Environment Variables
   124|
   125|Never create public versions of these variables.
   126|
   127|```env
   128|OPENAI_API_KEY=
   129|ANTHROPIC_API_KEY=
   130|GEMINI_API_KEY=
   131|SUPABASE_SERVICE_ROLE_KEY=
   132|STRIPE_SECRET_KEY=
   133|CRON_SECRET=
   134|VAPID_PRIVATE_KEY=
   135|```
   136|
   137|Never create these variables:
   138|
   139|```env
   140|NEXT_PUBLIC_OPENAI_API_KEY=
   141|NEXT_PUBLIC_ANTHROPIC_API_KEY=
   142|NEXT_PUBLIC_GEMINI_API_KEY=
   143|NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=
   144|NEXT_PUBLIC_STRIPE_SECRET_KEY=
   145|```
   146|
   147|Files that read secrets must stay server-only. Add `import "server-only";` to server-only modules that access API keys or service role credentials.
   148|
   149|## Auth
   150|
   151|This project uses Supabase Auth with `@supabase/ssr`.
   152|
   153|Supabase clients are separated by runtime:
   154|
   155|- Browser client: Client Components only, using public Supabase URL and anon key.
   156|- Server client: Server Components, Server Actions, and Route Handlers using cookie-backed sessions.
   157|- Admin client: server-only privileged operations that truly require the service role key.
   158|
   159|Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code and never create
   160|`NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`.
   161|
   162|For local auth callbacks, configure Supabase with:
   163|
   164|```text
   165|Site URL:
   166|http://localhost:3000
   167|
   168|Redirect URL:
   169|http://localhost:3000/auth/callback
   170|```
   171|
   172|The initial protected route is `/dashboard`. The initial auth status API is
   173|`/api/me`.
   174|
   175|### AI Provider Configuration
   176|
   177|Local development starts with the mock provider.
   178|
   179|```env
   180|AI_PROVIDER=mock
   181|```
   182|
   183|Development-only assistant tooling can be documented separately from production AI execution.
   184|
   185|```env
   186|DEVELOPMENT_AI_ASSISTANT=codex-sdk
   187|```
   188|
   189|Supported provider keys are prepared for later gateway implementation:
   190|
   191|```env
   192|OPENAI_API_KEY=
   193|OPENAI_MODEL=
   194|OPENAI_CODEX_MODEL=
   195|
   196|ANTHROPIC_API_KEY=
   197|ANTHROPIC_MODEL=
   198|
   199|GEMINI_API_KEY=
   200|GEMINI_MODEL=
   201|```
   202|
   203|Claude access must go through the server-side AI Provider Gateway. Client Components must never import Anthropic SDKs or read `ANTHROPIC_API_KEY`.
   204|
   205|### Codex SDK for Development Only
   206|
   207|Use the SDK/API route for development-only Codex experiments when the app needs a programmable integration point.
   208|
   209|Do not wire Codex access into production user-facing AI execution. Production routes should call the server-side AI Provider Gateway with explicit provider credentials, usage limits, audit logging, and safety checks.
   210|
   211|For local development, prefer:
   212|
   213|```text
   214|Development tool / local script
   215|  ↓
   216|OpenAI SDK / Responses API
   217|  ↓
   218|Codex-capable model
   219|  ↓
   220|Generated implementation notes, test drafts, or debug suggestions
   221|```
   222|
   223|Keep this separate from the product runtime:
   224|
   225|```text
   226|Browser / user-facing feature
   227|  ↓
   228|Next.js API Route / Server Action
   229|  ↓
   230|AI Provider Gateway
   231|  ↓
   232|OpenAI / Anthropic Claude / Gemini
   233|```
   234|
   235|Allowed development uses:
   236|
   237|- Running local SDK scripts for repository analysis
   238|- Running Codex CLI or Codex app tasks against the local repository
   239|- Generating implementation plans and review notes
   240|- Drafting tests, fixtures, and migration checks
   241|- Debugging local build, lint, and type errors
   242|
   243|Not allowed:
   244|
   245|- Calling Codex SDK/API experiments from browser code
   246|- Calling Codex SDK/API experiments from production API routes
   247|- Treating a personal ChatGPT/Codex session as a shared backend credential
   248|- Bypassing AI Provider Gateway cost limits, safety checks, or logs for user-facing features
   249|
   250|## Safety
   251|
   252|Ruletrade-AI does not provide investment advice.
   253|
   254|- AI output is used to identify missing rule-design elements, clarify assumptions, and generate follow-up questions.
   255|- AI output is checked before display. Outputs that look like buy/sell recommendations or guaranteed predictions are blocked.
   256|- The Safety Check layer scans AI-generated text for prohibited phrases (e.g. buy/sell recommendations, price predictions, profit guarantees, urgency pressure, privacy risks) and enforces a `block` / `warn` / `allow` decision.
   257|- See `docs/safety.md` for the full Safety Policy and prohibited phrase categories.
   258|
   259|## Project Structure
   260|
   261|This repository uses the Next.js `src` directory convention. The App Router
   262|lives in `src/app`, while reusable product code lives under feature and shared
   263|infrastructure directories.
   264|
   265|```text
   266|src/
   267|  app/
   268|    page.tsx
   269|    layout.tsx
   270|  components/
   271|    ui/
   272|  features/
   273|    rules/
   274|      components/
   275|      services/
   276|  lib/
   277|  schemas/
   278|    rules/
   279|  types/
   280|
   281|docs/
   282|  adr/
   283|
   284|tests/
   285|  unit/
   286|  schemas/
   287|  services/
   288|  api/
   289|  safety/
   290|  evals/
   291|  e2e/
   292|  fixtures/
   293|
   294|supabase/
   295|  migrations/
   296|  seed/
   297|```
   298|
   299|### Placement Rules
   300|
   301|- `src/app/`: Next.js App Router pages, layouts, and route handlers. Keep these
   302|  files thin and delegate product behavior to feature modules or shared
   303|  services.
   304|- `src/features/rules/`: MVP rule creation and review UI, workflow services,
   305|  prompt builders, hooks, and feature-local types.
   306|- `src/components/ui/`: reusable shadcn-style UI primitives that do not know
   307|  about trading concepts.
   308|- `src/lib/`: shared infrastructure such as auth, database clients, provider
   309|  gateways, errors, safety checks, config, and utilities.
   310|- `src/schemas/`: shared validation-ready domain schemas. Rule schemas live in
   311|  `src/schemas/rules/`.
   312|- `supabase/migrations/` and `supabase/seed/`: database schema changes and
   313|  non-production seed data.
   314|- `tests/`: unit, API, schema, RLS, safety, eval, and E2E coverage.
   315|
   316|Use the `@/*` import alias for code under `src/`. Prefer direct imports over
   317|barrel exports during the MVP so feature boundaries remain visible.
   318|
   319|### MVP vs Future Structure
   320|
   321|Create only the directories needed by the active MVP issue. Future feature
   322|areas such as portfolio, watchlist, documents, billing, notifications, RAG,
   323|analytics, and eval infrastructure should be added when their implementation
   324|issues start, not as empty placeholders.
   325|
   326|Server-only modules that read secrets or privileged credentials must include
   327|`import "server-only";`. Browser code must never import provider gateways,
   328|service-role Supabase clients, Stripe secret clients, or other privileged
   329|runtime modules directly.
   330|
   331|## AI Agent Development
   332|
   333|This repository includes instructions for AI coding agents.
   334|
   335|See:
   336|
   337|- `AGENTS.md`
   338|- `.github/copilot-instructions.md`
   339|- `.github/instructions/`
   340|- `.github/prompts/`
   341|- `docs/agents.md`
   342|
   343|AI agents should only work on small, scoped tasks.
   344|
   345|All agent PRs require human review and CI checks.
   346|
   347|
## Closed Beta

Ruletrade-AI supports a closed beta workflow:

- beta cohorts
- invite codes
- beta access grants
- beta feature flags
- launch stop switches
- launch readiness reviews

See:

- `docs/closed-beta.md`
- `docs/launch-readiness.md`

## Roadmap / Release Management

Ruletrade-AI includes a lightweight release management process:

- GitHub Projects for planning
- GitHub Milestones for beta phases
- release plans
- release checklists
- changelog entries
- release approvals
- rollback strategies
- public roadmap / changelog

See:

- `docs/roadmap.md`
- `docs/release-management.md`

## Engineering Governance

Ruletrade-AI uses lightweight engineering governance:

- Architecture Decision Records
- Pull Request template
- CODEOWNERS
- Issue Forms
- Technical Debt Register
- Engineering Exception Register
- Dependency Review
- Release Gates

See:

- `docs/adr.md`
- `docs/engineering-standards.md`
- `docs/technical-debt.md`
