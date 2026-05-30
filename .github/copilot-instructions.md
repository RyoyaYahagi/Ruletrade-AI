# GitHub Copilot Instructions

You are helping develop Ruletrade-AI.

## Product boundary

Ruletrade-AI helps users organize their own investment rules.

The app must not:

- recommend buying
- recommend selling
- guarantee profit
- guarantee loss avoidance
- predict future stock prices with certainty
- manage assets
- execute trades

Use wording like:

- "確認する"
- "整理する"
- "抜け漏れを確認する"
- "追加質問を提案する"

Avoid wording like:

- "買うべき"
- "売るべき"
- "おすすめ銘柄"
- "利益を最大化"
- "損失を避ける"

## Code rules

- Use TypeScript.
- Prefer explicit types at service boundaries.
- Validate request bodies with Zod.
- Use `requireUser()` for authenticated APIs.
- Never trust `userId` from the client.
- Use server-side ownership checks.
- Return safe error responses.
- Keep Client Components thin.
- Keep business logic in services.

## Security rules

- Never expose server secrets.
- Never use `SUPABASE_SERVICE_ROLE_KEY` in Client Components.
- Never call OpenAI or Gemini from Client Components.
- Do not log Authorization headers, cookies, tokens, or API keys.
- Redact sensitive data before logging.

## Database rules

- User-owned tables must have `user_id`.
- Enable RLS on user-owned tables.
- Policies must scope access by `auth.uid() = user_id`.
- Add DB/RLS tests for new user-owned tables.
- Do not modify old migrations unless explicitly requested.

## AI rules

- Use AI Provider Gateway.
- Use Mock Provider in tests.
- Validate AI output with Zod.
- Run Safety Check.
- Run Compliance Gate.
- Save AI Run Logs where appropriate.
- Do not display unsafe AI output.

## Testing rules

- Add unit tests for pure logic.
- Add API tests for auth/authorization.
- Add RLS tests for user-owned tables.
- Do not skip failing tests unless explicitly requested.
