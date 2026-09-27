# Architecture

Ruletrade-AI stores a person's investment thoughts as an append-only journal. The words the person entered are the source of truth. Extracted fields, summaries, and comparisons are derived data and can be regenerated or corrected without rewriting the original input.

The architecture follows a few product constraints:

- preserve the reasoning available at the time instead of rewriting history later;
- keep AI as an organizer rather than an investment decision-maker;
- reduce the friction of recording thoughts so that the journal is practical to continue;
- keep the single-user MVP intentionally small until more infrastructure is actually needed.

## Data model

SQLite stores four entities through Drizzle ORM:

- `stocks`: a ticker, display name, optional market, and creation time.
- `decisions`: a stock reference, event type, original input, optional transcript, extracted thesis and conditions, optional review date, and creation time.
- `transactions`: stock, buy/sell side, quantity, price, optional fee and decision link, execution time, and creation time.
- `reviews`: a required stock link, an optional decision link, the user's current input, comparison summary and differences, required user reflection, and creation time.

Each new decision or review is a new timeline event. A later thought does not replace an earlier one. This append-only approach is deliberate: the change between an earlier belief and a later belief is itself useful information for reflection.

The user's original words are kept separately from AI-derived fields. The app stores an answer to its single optional follow-up question separately from the original input. Optional facts such as an unknown purchase price remain absent; the app must not invent a value. The confirmation form explicitly sets an execution date when extraction did not provide one.

## Application flow

The Next.js App Router renders the home page, stock detail pages, and the transaction history. Server Actions handle database mutations. Minimal Route Handlers call a server-only Gemini client for extraction, audio transcription, and comparison.

A typical decision flow is:

1. The user writes or records an unstructured thought.
2. Voice input is transcribed and can be edited before extraction.
3. Gemini converts the input into structured fields such as thesis, assumptions, and review conditions.
4. Zod validates the model output.
5. The user reviews and edits the extracted result.
6. Only the confirmed result is stored alongside the original input.
7. A later review is added as another event instead of modifying the earlier record.

Voice capture uses the browser's `MediaRecorder` API. The recording is sent to the server for transcription and decision extraction. The server keeps the Gemini API key private.

## AI boundary

Gemini organizes the user's words and compares current input with the selected stock's recorded decisions. It does not make investment decisions or tell the user to buy or sell. Comparison output describes differences between recorded thinking; it does not decide what those differences mean for a trade.

This boundary is intentional. AI is used where it lowers input and review friction:

- transcription;
- extraction from free-form text;
- structuring a decision into fields;
- comparison of earlier and current thinking.

The user's wording remains the source of truth, and AI output is treated as derived data that must be validated and confirmed before persistence.

## Technology choices

### Next.js + React + TypeScript

The MVP keeps UI and server-side application logic in one codebase. Next.js provides the App Router, Server Actions, and Route Handlers needed for the current product without introducing a separate frontend and backend service.

TypeScript is used across the application so that UI data, AI output, validation schemas, and persistence code can share explicit types and fail earlier when their shapes drift apart.

For a single-user MVP, keeping these concerns together is more valuable than introducing service boundaries that are not yet required.

### SQLite

Ruletrade-AI is currently a local, single-user application. It does not need concurrent multi-user access, horizontal scaling, or a managed database service.

SQLite was chosen because it:

- runs locally with no separate database server;
- keeps the development and deployment footprint small;
- makes the application's data easy to inspect and back up;
- is sufficient for the current access pattern.

If the product later requires authentication, multiple users, remote shared access, or higher write concurrency, the database choice can be revisited at that point rather than paying that complexity cost in the MVP.

### Drizzle ORM

Drizzle is used as a relatively thin persistence layer between TypeScript and SQLite.

The goal is to keep schema definitions and application types close together while preserving visibility into the relational model. The project does not need a highly abstract data layer; understanding exactly what is stored is important because original user input and AI-derived data have different roles.

### Gemini

Gemini is used for three bounded tasks:

- audio transcription;
- structured extraction from free-form investment notes;
- comparison of current and historical thinking.

The project benefits from using one model family for both audio and text-oriented workflows, while keeping all model calls behind a server-only boundary.

Gemini is not used as an autonomous trading agent. It does not place orders or decide whether the user should buy or sell.

### Zod

LLM output is probabilistic and cannot be treated as valid application data merely because it is syntactically parseable.

Zod validates model output before it reaches the confirmation UI or persistence layer. The user then confirms or edits the extracted data before saving it.

This creates a deliberate boundary:

```
user input
    ↓
Gemini
    ↓
Zod validation
    ↓
user confirmation
    ↓
SQLite
```

### Vitest + Playwright

Vitest covers application logic and focused tests. Playwright covers user-visible flows where multiple layers need to work together.

For this project, a particularly important path is:

```
input → AI extraction → confirmation → save → later review
```

Testing that flow matters more than maximizing isolated test coverage, because the product's value depends on the full recording and reflection loop continuing to work.

## Deliberate scope

This is a local, single-user MVP. It intentionally has no:

- authentication or user-ownership model;
- document search or embeddings;
- vector database;
- provider gateway;
- multi-agent routing;
- external API contract;
- notification service.

Those omissions are not placeholders for infrastructure that must automatically be added later. They are features to introduce only when a concrete product requirement makes them necessary.

The local database is `.data/ruletrade-mvp.sqlite`, configurable through `RULETRADE_DATABASE_PATH`; it is separate from the former database and has no migration path from the old schema.
