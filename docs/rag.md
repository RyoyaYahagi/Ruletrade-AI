# RAG MVP

Ruletrade-AI uses RAG to retrieve the user's own past rules, watchlist notes, portfolio notes, and review summaries.

RAG is used as reference context for:

- rule review
- question generation
- watchlist review
- portfolio review

RAG does not provide investment advice.

The AI must treat retrieved context as reference only and prioritize current user input.

All RAG documents and chunks are user-owned and protected by ownership checks.

RAG-derived context shown through an AI result is labeled 「あなたの過去のメモ・判断から」. It is a reference for consistency checks only; current user input takes precedence, and it must never be turned into a buy/sell prompt or recommendation.
