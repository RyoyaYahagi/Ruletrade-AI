# Safety Policy

Ruletrade-AI is a rule-design support app, not an investment advice app.

## What the AI Must Not Do

- Recommend buying specific stocks
- Recommend selling specific stocks
- Predict future prices with certainty
- Guarantee profit
- Guarantee loss avoidance
- Make investment decisions for the user
- Pressure the user with urgency
- Use fear-mongering expressions
- Request secret information (passwords, API keys, etc.)

## What the AI Can Do

- Identify missing elements in investment rules
- Clarify vague conditions
- Generate follow-up questions
- Confirm risk management items
- Support review and reflection

## Safety Check Flow

```
AI Provider
  ↓
Zod Schema validation
  ↓
Rule-based Safety Check
  ↓
Optional AI Safety Judge (future)
  ↓
passed → DB save & UI display
failed → UI hidden & log saved & safe fallback message displayed
```

## Decision Levels

- **allow**: Display to user. Safe content.
- **warn**: Display to user, but log for review. Wording improvement suggested.
- **block**: Do not display AI output text to user. Show safe fallback message instead.

## Prohibited Expression Categories

1. **Buy Recommendation** — "買うべき", "今すぐ買い", "購入をおすすめ"
2. **Sell Recommendation** — "売るべき", "今すぐ売り", "売却をおすすめ"
3. **Price Prediction** — "必ず上がる", "確実に上昇", "株価は2倍"
4. **Profit Guarantee** — "利益が出ます", "儲かります"
5. **Loss Avoidance Guarantee** — "損しません", "リスクはありません"
6. **Decision Delegation** — "実行してください", "判断はこれで決まり"
7. **Urgency Pressure** — "今すぐ", "急いで", "迷わず"
8. **Fear Mongering** — "手遅れ", "大損します", "致命的"
9. **Privacy Risk** — "証券口座のパスワード", "APIキーを貼って"

## False Positive / False Negative Prevention

Tests must cover both:
- **False negative prevention**: Dangerous expressions must be reliably blocked
- **False positive prevention**: Neutral rule-review and risk-management wording must not be blocked

## Safety Versioning

Safety rules are versioned. Current version: `safety-rules-v1`

Saved with each review:
- `prompt_version`
- `safety_rule_version`
- `safety_passed`
- `safety_risk_level`
- `safety_violation_types`
