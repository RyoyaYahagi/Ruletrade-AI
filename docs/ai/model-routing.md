# AI Model Routing

## Overview

Ruletrade-AI uses task-based model routing instead of hard-coding model names in feature services.

## Task Types

| Task Type | Purpose | Default Model | Temperature |
|-----------|---------|---------------|-------------|
| `intake_question` | User intake | gpt-4o-mini | 0.7 |
| `rule_draft_generation` | Rule drafting | gpt-4o | 0.7 |
| `rule_review` | Rule review | gpt-4o | 0.5 |
| `safety_check` | Safety validation | gpt-4o | 0.1 |
| `compliance_check` | Compliance validation | gpt-4o | 0.1 |
| `eval_judge` | Evaluation | gpt-4o | 0.2 |
| `embedding` | Vector embedding | text-embedding-3-small | 0 |

## Agent Names

Agents can override task defaults:

- `intake_agent`
- `rule_builder_agent`
- `rule_review_agent`
- `safety_agent`
- `compliance_agent`
- `eval_agent`

## Usage

```typescript
import { resolveAIModelConfig } from "@/features/ai/services/ai-model-router";

const config = resolveAIModelConfig("rule_review", "rule_review_agent");
// config.provider, config.model, config.temperature, etc.
```

## Environment Override

Set to override default models:

```text
AI_MODEL_OVERRIDE_rule_review=gpt-4o
AI_PROVIDER_OVERRIDE_rule_review=openai
```

## Fallback

If primary model fails, fallback config is used with extended timeout.

## Mock Provider

For tests, use `mock` provider:

```typescript
const config = resolveAIModelConfig("safety_check");
// config.provider === "mock"
```
