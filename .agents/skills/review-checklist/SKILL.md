---
name: review-checklist
description: Ruletrade-AI固有のコードレビュー観点集。diff・PR・ブランチのレビュー（/code-review、「レビューして」「レビューお願い」、マージ前確認）を行うときは必ず読み込み、一般的なレビュー観点に追加して適用する。
---

# Ruletrade-AI Review Checklist

Baseline: the product scope, data preservation, fallback, comment, and testing
rules in `AGENTS.md` apply to every diff — verify compliance first. This file
adds judgment-heavy checks that cannot be enforced mechanically by CI or lint.

## Domain / safety (highest priority)

- Original input remains the source of truth; extraction and comparison are
  derived data. Preserve original text, transcripts, and follow-up answers.
- New thoughts append timeline events rather than overwriting past decisions.
- Validate Gemini output with Zod before saving or displaying it.
- Keep the current single-user scope: no authentication, ownership layer,
  additional AI provider, or provider abstraction without a scope change.
- Transaction prices that are unknown stay empty rather than becoming zero.
- No copy that reads as a buy/sell recommendation or investment advice.
- Gemini calls and secrets remain server-side: no `NEXT_PUBLIC_` misuse, no
  server-only module imported into a Client Component.
- Keep private input and secrets out of logs and committed database files.

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
