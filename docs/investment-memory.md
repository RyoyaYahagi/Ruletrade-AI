# Investment Memory

## Overview

Investment Memory allows each user to store their persistent trading preferences and constraints. This memory is read by the rule-generation agent to tailor outputs to the user's style and constraints.

## Data Model

| Field | Type | Description |
|-------|------|-------------|
| `risk_tolerance` | `conservative \| moderate \| aggressive` | User's risk appetite |
| `preferred_markets` | `{ market: string, weight?: number }[]` | Markets the user prefers |
| `time_horizons` | `{ horizon: string, description?: string }[]` | Preferred holding periods |
| `rejected_patterns` | `{ pattern: string, reason?: string }[]` | Patterns the user explicitly dislikes |
| `standing_constraints` | `{ constraint: string, appliesTo?: string[] }[]` | Always-on constraints |
| `notes` | `string` | Free-form notes for the agent |

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/investment-memory` | Retrieve the current user's memory |
| POST | `/api/investment-memory` | Create or update the memory |
| DELETE | `/api/investment-memory` | Remove the memory |

## Service Functions

- `getInvestmentMemory(userId)` — fetch the record (nullable)
- `upsertInvestmentMemory(input)` — insert or update (1 record per user)
- `deleteInvestmentMemory(userId)` — remove the record

## ownership checks

Users can only CRUD their own `user_investment_memories` row.
