# Evals

Ruletrade-AI uses evals to improve AI review quality.

## Metrics

- Precision
- Recall
- F1
- Schema Valid Rate
- Safety Pass Rate
- Latency
- Estimated Cost

## MVP Eval Cases

- `missing_stop_loss_should_fail`
- `missing_max_position_should_warn`
- `complete_rule_should_pass`
- `buy_recommendation_should_be_blocked`

## Process

1. Run evals
2. Inspect failed cases
3. Update prompt / schema / safety
4. Run evals again
5. Compare by prompt version

## Running Evals

```bash
npm run test:eval
```

The eval runner compares expected quality checks with actual AI output and reports precision, recall, F1, schema validity, safety pass rate, latency, and estimated cost.

## Eval Tables

- `eval_cases` — evaluation cases
- `eval_runs` — evaluation run summaries
- `eval_run_results` — per-case results
