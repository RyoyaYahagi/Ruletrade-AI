# Architecture

Ruletrade-AI stores a person's investment thoughts as an append-only journal. The words the person entered are the source of truth. Extracted fields, summaries, and comparisons are derived data and can be regenerated or corrected without rewriting the original input.

## Data model

SQLite stores four entities through Drizzle ORM:

- `stocks`: a ticker, display name, optional market, and creation time.
- `decisions`: a stock reference, event type, original input, optional transcript, extracted thesis and conditions, optional review date, and creation time.
- `transactions`: stock, buy/sell side, quantity, price, optional fee and decision link, execution time, and creation time.
- `reviews`: a required stock link, an optional decision link, the user's current input, comparison summary and differences, required user reflection, and creation time.

Each new decision or review is a new timeline event. A later thought does not replace an earlier one. The app stores an answer to its single optional follow-up question separately from the original input. Optional facts such as an unknown purchase price remain absent; the app must not invent a value. The confirmation form explicitly sets an execution date when extraction did not provide one.

## Application flow

The Next.js App Router renders the home page, stock detail pages, and the transaction history. Server Actions handle database mutations. Minimal Route Handlers call a server-only Gemini client for extraction, audio transcription, and comparison. Zod validates model output before it reaches the confirmation UI or database. The user confirms an extracted decision before it is saved. Voice recordings are transcribed first; the user can edit the transcript before it is sent to the separate extraction route. If the model asks one follow-up question, the user's answer is saved separately from the original input.

Voice capture uses the browser's `MediaRecorder` API. The recording is sent to the server for transcription and decision extraction. The server keeps the Gemini API key private.

## AI boundary

Gemini organizes the user's words and compares current input with the selected stock's recorded decisions. It does not make investment decisions or tell the user to buy or sell. Comparison output describes differences between recorded thinking; it does not decide what those differences mean for a trade.

## Deliberate scope

This is a local, single-user MVP. It has no authentication, user-ownership model, document search, embeddings, vector database, provider gateway, multi-agent routing, external API contract, or notification service. The local database is `.data/ruletrade-mvp.sqlite`, configurable through `RULETRADE_DATABASE_PATH`; it is separate from the former database and has no migration path from the old schema.
