# Risk Review

## Warning Categories

| Category | Severity | Blocker | Description |
|----------|----------|---------|-------------|
| `missing_exit` | critical | Yes | No exit conditions defined |
| `missing_risk_limit` | high | Yes | Missing maxPositionSize or maxLossPerTrade |
| `contradiction` | high | Yes | Entry and exit conditions conflict |
| `unsafe_parameter` | high | Yes | Extreme parameter values |
| `overfitting` | medium | No | Too many conditions (>5) |
| `insufficient_evidence` | medium | No | No supporting evidence |
| `explanation_mismatch` | low | No | Summary too short |

## Review Flow

1. Rule is created (status: `draft`)
2. Risk review runs automatically
3. If blockers exist → status becomes `blocked`
4. If no blockers → status can advance to `in_review`
5. Human reviewer approves → `approved`

## Deterministic Checks

The risk reviewer runs these checks before any LLM review:

- Exit conditions exist
- Risk limits defined
- No contradictions
- Reasonable parameter ranges
- Evidence provided

## Blockers Prevent Approval

Rules with blocker warnings cannot be approved until fixed.
