# Ruletrade-AI — simplified MVP

Ruletrade-AI is an **investment decision journal with AI**, not a trading-rule engine.

The core problem is small:

> I know why I bought something today, but months later I may forget the assumptions I had at the time. Record those thoughts with as little friction as possible, then let AI compare my current thinking with my past thinking.

## MVP

1. **Quick capture by text or voice**
   - Speak or type a rough investment note.
   - Gemini transcribes/structures it.
   - The user reviews and edits the structured result before saving.
2. **Decision timeline per stock**
   - Keep the original note plus thesis, assumptions, sell/review conditions, and add conditions.
   - Do not overwrite old thinking.
3. **AI self-review**
   - Enter what you think now.
   - AI compares it only with your own saved history and highlights what stayed the same or changed.
4. **Review date**
   - Add an optional date to revisit a decision.
5. **30-second sell review**
   - A sell transaction can include a short reflection explaining why it was sold.
6. **Trade history**
   - Record buy/sell date, quantity, price, fees, and a short note.

## Intentionally not in this MVP

- brokerage sync / order execution
- stock-price or news ingestion
- RAG / embeddings
- PDF ingestion
- multi-agent workflows
- provider gateway / model routing
- quality scores and approval-state machines
- OpenAPI
- Stripe / billing
- public multi-user auth
- portfolio optimization / backtesting

These are not "planned by default." They should be added only when the current workflow proves they are needed.

## Data model

Only four domain tables:

```text
stocks
├─ decisions
├─ transactions
└─ reviews
```

A decision stores both the user's original text and editable AI-derived fields. The original note is the historical source of truth.

## Stack

- Next.js 16 / React 19 / TypeScript
- SQLite with direct `better-sqlite3` queries
- Zod for request and AI-output validation
- Gemini REST API
- plain CSS
- Vitest

No ORM and no custom query-builder are used in this version. The database layer is intentionally a small set of explicit queries.

## Local setup

```bash
npm install
cp .env.example .env.local
# set GEMINI_API_KEY
npm run dev
```

The SQLite database is created at `./data/ruletrade.sqlite` by default.

## Checks

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Deployment note

This branch is intentionally local-first. A filesystem SQLite database is not a good fit for stateless serverless deployment. If multi-device/public deployment becomes a real requirement, replace the persistence boundary then; do not carry that complexity before it is needed.

## Safety boundary

Ruletrade-AI does not tell the user what to buy or sell. AI is used for transcription, structuring the user's own notes, and comparing current notes with past notes.
