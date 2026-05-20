# AI Provider Gateway

The AI Provider Gateway hides provider-specific differences.

## Providers

- mock
- openai
- gemini

## Why use a gateway

- switch providers
- test with mock output
- centralize logging
- centralize safety checks
- centralize cost tracking

## Rule

Client components must never call AI providers directly.
