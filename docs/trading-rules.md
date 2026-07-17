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

銘柄別ルールでは、次の構造化フィールドも使います。

```json
{
  "thesisBreakers": [
    {
      "description": "主力事業の減収が2四半期続く",
      "newsKeywords": ["減収", "業績予想"]
    }
  ],
  "monitoring": {
    "stopLossReviewPercent": 15,
    "takeProfitReviewPercent": 30,
    "drawdownFromHighPercent": 20,
    "cooldownDailyDropPercent": 8,
    "cooldownHours": 24,
    "reviewCycle": "quarterly"
  }
}
```

`thesisBreakers` は仮説を見直す事実の候補、`monitoring` は価格確認の条件です。
監視トリガーは事実を通知するだけで、売買や注文は実行しません。これらは optional
default 付きで、旧形式の `rule_json` もそのまま読み込めます。

## Natural Language Summary

Rules include a `natural_language_summary` derived from structured fields for human-readable explanations.

## Versioning

Rules are versioned. Each update increments the version number.

## API

- `POST /api/admin/trading-rules` — Create rule
- `GET /api/admin/trading-rules` — List rules
