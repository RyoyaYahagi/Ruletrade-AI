# ADR 0003: Use AI Provider Gateway

## Status

Accepted

## Context

Ruletrade-AI should support Mock, OpenAI, and Gemini providers.

## Decision

Create a server-side AI Provider Gateway.

## Consequences

Positive:

- testable with mock provider
- easier provider switching
- central logging
- central safety checks

Negative:

- extra abstraction
- provider-specific features need mapping
