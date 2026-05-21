# Backtest Evaluation

## Overview

Generated rules must carry evidence before users approve them. Backtest evaluation is a separate agent responsibility.

## Evaluation Fields

| Field | Description |
|-------|-------------|
| test_window_start | Test period start date |
| test_window_end | Test period end date |
| sample_size | Number of trades in test |
| total_return_percent | Total return |
| annualized_return_percent | Annualized return |
| max_drawdown_percent | Maximum drawdown |
| sharpe_ratio | Risk-adjusted return |
| win_rate_percent | Percentage of winning trades |
| confidence_level | Statistical confidence (0-1) |
| confidence_description | Human-readable confidence assessment |
| known_failure_cases | Scenarios where the rule fails |
| limitations | Known limitations of the backtest |

## Workflow State

- `pending` — Evaluation not yet started
- `running` — Evaluation in progress
- `completed` — Evaluation finished with results
- `failed` — Evaluation could not complete

## Blockers

Rules without a completed evaluation remain in `blocked` or `in_review` status.

## Audit Trail

- `evaluated_by` — User or agent who completed the evaluation
- `evaluated_at` — Completion timestamp
