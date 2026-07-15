# Architecture Overview

Ruletrade-AI is built around user-owned investment rule data.

## Main components

```mermaid
graph TD
  Browser[Browser / Client UI]
  Next[Next.js Server]
  Auth[Local session auth]
  DB[(SQLite)]
  Storage[(Local file storage)]
  AI[AI Provider Gateway]
  OpenAI[OpenAI]
  Gemini[Gemini]
  Mock[Mock Provider]

  Browser --> Next
  Next --> Auth
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
