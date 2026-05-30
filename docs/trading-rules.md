# Trading Rules

## Overview

Trading rules in Ruletrade-AI are structured, reviewable data rather than free-form text.

## Rule Status

| Status | Description |
|--------|-------------|
| `draft` | Initial state, editable |
| `in_review` | Under review |
| `blocked` | Review blocked, needs changes |
| `approved` | Approved for use |
| `rejected` | Rejected, not usable |

## Rule Structure

```json
{
  "name": "BTC breakout strategy",
  "description": "Buy when BTC breaks above 50-day MA",
  "status": "approved",
  "entryConditions": [
    {
      "field": "price",
      "operator": "gt",
      "value": 50000,
      "description": "Price above $50k"
    }
  ],
  "exitConditions": [
    {
      "field": "price",
      "operator": "lt",
      "value": 45000,
      "description": "Stop loss at $45k"
    }
  ],
  "riskLimits": {
    "maxPositionSize": 1000,
    "maxLossPerTrade": 100,
    "stopLossPercent": 5
  },
  "assumptions": [
    {
      "assumption": "BTC volatility remains high",
      "confidence": "medium"
    }
  ],
  "evidence": [
    {
      "source": "Backtest 2024-01",
      "observation": "Strategy yielded 15% return"
    }
  ],
  "warnings": [
    {
      "warning": "High volatility may trigger false breakouts",
      "severity": "high",
      "mitigation": "Use volume confirmation"
    }
  ],
  "approvalRequirements": {
    "requiresHumanReview": true,
    "requiresComplianceCheck": true,
    "requiresRiskAssessment": true
  }
}
```

## Natural Language Summary

Rules include a `natural_language_summary` derived from structured fields for human-readable explanations.

## Versioning

Rules are versioned. Each update increments the version number.

## API

- `POST /api/admin/trading-rules` — Create rule
- `GET /api/admin/trading-rules` — List rules
