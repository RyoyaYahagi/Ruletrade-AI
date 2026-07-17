---
name: ruletrade
description: Safely use Ruletrade-AI MCP tools to inspect user-owned rules and record human-provided draft answers.
---

# Ruletrade-AI

Ruletrade-AI helps a person organize their own investment rules. It does not provide investment advice, buy/sell recommendations, asset management, brokerage services, or order execution.

## Connection

Use a Personal Access Token issued in the web UI and connect to `https://<host>/api/mcp` with `Authorization: Bearer rta_<64 hex characters>`.

## Safe workflows

To progress a rule session: call `create_rule_session` only when the user asks, then call `get_next_question`, ask the human the question, and call `answer_question` with the human's answer. Never invent an answer. Repeat until the draft is complete, then direct the human to the web UI for review and finalize.

For a morning check: call `get_today_items` and summarize factual confirmation items. Do not mark notifications read, resolve them, or decide whether a rule should be kept or revised.

## Prohibited actions

Do not perform finalize/approval, notification responses, deletion, account changes, AI budget changes, or any operation that could execute a trade. Keep tokens scoped to one user and never expose them in prompts, logs, or source control.
