# Feature Flags

## Overview

DB-based feature flags for safe, incremental rollouts. No external service dependency in MVP.

## Architecture

```
lib/config/feature-flags/
  types.ts           — interfaces
  static-provider.ts — hardcoded defaults (dev/tests)
  db-provider.ts     — DB-driven evaluation (production)
  index.ts           — provider factory
```

## Tables

- `feature_flags` — flag definitions
- `feature_flag_rules` — environment/user-specific rules
- `feature_flag_evaluations` — evaluation audit log
- `feature_flag_change_logs` — change history

## Rule Priority

1. Safety-critical guard (always on in production)
2. Explicit user targeting
3. Role targeting
4. Plan targeting
5. Experience level targeting
6. Percentage rollout
7. Environment default
8. Global default

## Safety Critical Flags

These cannot be disabled in production:

- `enable_safety_check`
- `enable_ai_output_schema_validation`
- `enable_rate_limit`
- `enable_cost_limit`

## Usage

```ts
import { getFeatureFlagProvider } from "@/lib/config/feature-flags";

const flags = getFeatureFlagProvider();
const enabled = await flags.getFlag("enable_user_memory_rag", false, {
  environment: "production",
  userId: user.id,
  role: "user",
});
```

## Client-Safe Flags

Only these are exposed to the client via `/api/config/flags`:

- `enablePortfolio`
- `enableWatchlist`
- `enableCsvImport`
- `enableDocumentUpload`
- `questionFlowVariant`
- `enablePushNotifications`

## Static Defaults (Local/Dev)

```ts
enable_mock_provider: true;
enable_openai_provider: false;
enable_user_memory_rag: true;
enable_document_rag: false;
```
