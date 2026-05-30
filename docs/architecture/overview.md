# Architecture Overview

Ruletrade-AI is built around user-owned investment rule data.

## Main components

```mermaid
graph TD
  Browser[Browser / Client UI]
  Next[Next.js Server]
  SupabaseAuth[Supabase Auth]
  DB[(Supabase Postgres)]
  Storage[(Supabase Storage)]
  AI[AI Provider Gateway]
  OpenAI[OpenAI]
  Gemini[Gemini]
  Mock[Mock Provider]

  Browser --> Next
  Next --> SupabaseAuth
  Next --> DB
  Next --> Storage
  Next --> AI
  AI --> OpenAI
  AI --> Gemini
  AI --> Mock
```

## Core principle

The browser is not trusted.

All sensitive operations happen server-side.
