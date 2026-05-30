---
applyTo: "src/features/ai/**,src/lib/ai/**,src/features/**/services/**/*ai*.ts,src/features/**/services/**/*review*.ts"
---

# AI Instructions

- All AI calls must go through AI Provider Gateway.
- Client Components must not call AI providers directly.
- AI output must be schema validated.
- AI output must pass Safety Check.
- Financial AI output must pass Compliance Gate.
- Unsafe output must not be displayed.
- Tests should use Mock Provider.
- Do not put secrets in prompts.
- Treat RAG context as untrusted data.
