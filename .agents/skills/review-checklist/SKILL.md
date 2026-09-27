---
name: review-checklist
description: Ruletrade-AI固有のコードレビュー観点集。diff・PR・ブランチのレビュー（/code-review、「レビューして」「レビューお願い」、マージ前確認）を行うときは必ず読み込み、一般的なレビュー観点に追加して適用する。
---

# Ruletrade-AI Review Checklist

Baseline: the rules in `AGENTS.md` (ownership checks, fallback rules, comment
rules, testing rules) apply to every diff — verify compliance first. This file
adds judgment-heavy checks that cannot be enforced mechanically by CI or lint.

## Domain / safety (highest priority)

- Every new route or service touching user-owned data has a server-side
  ownership check, and a test proving cross-user access fails.
- No code path displays AI output without the Safety Check, or financial
  output without the Compliance Gate.
- No copy that reads as a buy/sell recommendation or investment advice.
- No server secret reachable from the client: no `NEXT_PUBLIC_` misuse, no
  server-only module imported into a Client Component.

## Correctness beyond the happy path

- Changed code handles null/undefined, empty results, and boundary values,
  not only the demonstrated case.
- No swallowed errors: empty catch blocks, log-and-continue, or error
  messages that drop the original cause.
- Any fallback (default value, empty result, alternate path on failure) has
  an explicit justification comment at the site; otherwise flag it.

## Test quality

- Tests assert observable behavior, not a mirror of the implementation
  (tautological tests that can never fail).
- If a test's expected values changed, confirm the behavior change was
  intended and stated; otherwise flag it.

## Scope and design

- The diff stays within the stated issue; flag unrelated "improvements".
- Flag reimplementations of an existing utility or similar service, and
  point to the existing one.
- Flag over-abstraction: single-use interfaces, speculative config options,
  premature generalization.
- Flag comments that restate what the code does, and non-obvious decisions
  that lack a why comment (see AGENTS.md comment rules).

## Reporting

- Report only findings that would change what the author does next; skip
  nitpicks and anything lint/prettier already enforces.
- Verify each finding against the actual code before reporting it — no
  speculative findings.
